"""End-to-end training and evaluation pipeline (paper Algorithm 1).

Usage (from the backend folder):
    python -m ml.train                              # uses data/raw/<file> if present, else the demo sample
    python -m ml.train --data data/raw/hrast.csv    # explicit file
    python -m ml.train --data file.csv --text-col sentence --sentiment-col sentiment

Outputs in backend/artifacts/: model.joblib, results.json,
test_predictions.csv and figures/*.png.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score, hamming_loss, precision_recall_fscore_support,
                             precision_score, recall_score)
from sklearn.model_selection import train_test_split
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.svm import LinearSVC

from . import analytics as va
from .config import (ARTIFACTS_DIR, ASPECT_THRESHOLD, DEMO_FILE, FIGURES_DIR, MODEL_FILE,
                     PAPER_CORRELATION_ASPECTS, PAPER_REPORTED, RANDOM_STATE, RAW_DIR,
                     RESULTS_FILE, SENTIMENTS, TEST_SIZE)
from .data_loader import load_dataset


def pick_dataset(explicit: str | None) -> tuple[Path, bool]:
    if explicit:
        return Path(explicit), "DEMO_SYNTHETIC" in Path(explicit).name
    if RAW_DIR.exists():
        files = sorted(p for p in RAW_DIR.iterdir()
                       if p.suffix.lower() in (".csv", ".tsv", ".xlsx", ".xls", ".json", ".zip"))
        if files:
            return files[0], False
    return DEMO_FILE, True


def match_aspects(wanted: list[str], available: list[str]) -> list[str]:
    """Map the paper's six aspect names onto the dataset's own column names."""
    norm = lambda s: re.sub(r"[^a-z]", "", s.lower())
    out = []
    for w in wanted:
        nw = norm(w)
        hit = next((a for a in available if norm(a) == nw), None) or \
            next((a for a in available if norm(a).startswith(nw[:5]) or nw.startswith(norm(a)[:5])), None)
        if hit and hit not in out:
            out.append(hit)
    return out


def r4(x) -> float:
    return round(float(x), 4)


def train(data_path: str | None = None, aspect_class_weight: str | None = "balanced",
          sentiment_class_weight: str | None = "balanced", **overrides) -> dict:
    t0 = time.time()
    path, synthetic = pick_dataset(data_path)
    print(f"[1/7] Loading dataset: {path}{'  (SYNTHETIC DEMO SAMPLE)' if synthetic else ''}")
    df, rep = load_dataset(path, **overrides)
    print(f"      raw={rep.raw_rows}  clean={rep.clean_rows}  aspects={len(rep.aspect_cols)}")
    print(f"      columns: text={rep.text_col!r} sentiment={rep.sentiment_col!r} aspects={rep.aspect_mode}")
    print("      sentiment counts: " + ", ".join(f"{k}={v}" for k, v in df["sentiment"].value_counts().items()))
    if df["sentiment"].nunique() < 3:
        print("      WARNING: fewer than 3 sentiment classes found. Check the sentiment column with ml.inspect_data.")

    print("[2/7] Train/test split (80/20, stratified by sentiment, random_state=42)")
    train_df, test_df = train_test_split(df, test_size=TEST_SIZE, random_state=RANDOM_STATE,
                                         stratify=df["sentiment"])

    print("[3/7] TF-IDF (fitted on the training split only)")
    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_df=0.95, sublinear_tf=True,
                          max_features=60000)
    Xtr = vec.fit_transform(train_df["clean"])
    Xte = vec.transform(test_df["clean"])

    print("[4/7] One-vs-Rest Logistic Regression for multi-label aspects (threshold 0.50)")
    train_counts = pd.Series([a for l in train_df["aspects"] for a in l]).value_counts()
    aspects = [a for a in rep.aspect_cols if train_counts.get(a, 0) >= 2]
    mlb = MultiLabelBinarizer(classes=aspects)
    Ytr = mlb.fit_transform(train_df["aspects"].map(lambda l: [a for a in l if a in aspects]))
    Yte = mlb.transform(test_df["aspects"].map(lambda l: [a for a in l if a in aspects]))
    aspect_clf = OneVsRestClassifier(
        LogisticRegression(max_iter=2000, C=4.0, class_weight=aspect_class_weight, solver="liblinear"))
    aspect_clf.fit(Xtr, Ytr)
    Pte = aspect_clf.predict_proba(Xte)
    Yhat = (Pte >= ASPECT_THRESHOLD).astype(int)
    p, r, f, s = precision_recall_fscore_support(Yte, Yhat, average=None, zero_division=0)
    aspect_metrics = {
        "subset_accuracy": r4(accuracy_score(Yte, Yhat)),
        "micro_precision": r4(precision_score(Yte, Yhat, average="micro", zero_division=0)),
        "micro_recall": r4(recall_score(Yte, Yhat, average="micro", zero_division=0)),
        "micro_f1": r4(f1_score(Yte, Yhat, average="micro", zero_division=0)),
        "macro_f1": r4(f1_score(Yte, Yhat, average="macro", zero_division=0)),
        "hamming_loss": r4(hamming_loss(Yte, Yhat)),
        "per_aspect": [{"aspect": a, "precision": r4(p[i]), "recall": r4(r[i]), "f1": r4(f[i]),
                        "support": int(s[i])} for i, a in enumerate(aspects)],
    }
    print(f"      micro-F1={aspect_metrics['micro_f1']}  macro-F1={aspect_metrics['macro_f1']}"
          f"  hamming={aspect_metrics['hamming_loss']}")

    print("[5/7] Sentiment: Logistic Regression vs Linear SVM")
    ytr, yte = train_df["sentiment"].values, test_df["sentiment"].values
    lr = LogisticRegression(max_iter=3000, C=4.0, class_weight=sentiment_class_weight)
    svm = LinearSVC(C=0.5)
    lr.fit(Xtr, ytr)
    svm.fit(Xtr, ytr)
    labels = [s for s in SENTIMENTS if s in set(ytr)]
    sent_models, confusions, preds = {}, {}, {}
    for name, model in (("logistic_regression", lr), ("linear_svm", svm)):
        yp = model.predict(Xte)
        preds[name] = yp
        sent_models[name] = {
            "accuracy": r4(accuracy_score(yte, yp)),
            "macro_precision": r4(precision_score(yte, yp, average="macro", zero_division=0)),
            "macro_recall": r4(recall_score(yte, yp, average="macro", zero_division=0)),
            "macro_f1": r4(f1_score(yte, yp, average="macro", zero_division=0)),
            "weighted_f1": r4(f1_score(yte, yp, average="weighted", zero_division=0)),
        }
        confusions[name] = {"labels": labels,
                            "matrix": confusion_matrix(yte, yp, labels=labels).tolist()}
        print(f"      {name}: acc={sent_models[name]['accuracy']} macroF1={sent_models[name]['macro_f1']}")
    rep_lr = classification_report(yte, preds["logistic_regression"], labels=labels,
                                   output_dict=True, zero_division=0)
    classwise = [{"class": c, "precision": r4(rep_lr[c]["precision"]), "recall": r4(rep_lr[c]["recall"]),
                  "f1": r4(rep_lr[c]["f1-score"]), "support": int(rep_lr[c]["support"])} for c in labels]
    for key, label in (("macro avg", "macro average"), ("weighted avg", "weighted average")):
        classwise.append({"class": label, "precision": r4(rep_lr[key]["precision"]),
                          "recall": r4(rep_lr[key]["recall"]), "f1": r4(rep_lr[key]["f1-score"]),
                          "support": int(rep_lr[key]["support"])})
    best_acc = max(sent_models, key=lambda k: sent_models[k]["accuracy"])
    best_f1 = max(sent_models, key=lambda k: sent_models[k]["macro_f1"])

    print("[6/7] Voice of Customer analytics (correlation, frequency, negative rate)")
    amat = va.aspect_matrix(df["aspects"], rep.aspect_cols)
    corr = va.phi_correlation(amat)
    six = match_aspects(PAPER_CORRELATION_ASPECTS, rep.aspect_cols)
    freq = va.aspect_frequency(df["aspects"], len(df))
    neg = va.negative_rates(df["aspects"], df["sentiment"], min_total=20 if len(df) > 2000 else 3)

    # Interpretable model terms (top TF-IDF weights of the LR sentiment model).
    feats = np.array(vec.get_feature_names_out())
    top_terms = {}
    from .predictor import class_coefs
    for c, w in class_coefs(lr).items():
        top_terms[c] = feats[np.argsort(w)[::-1][:15]].tolist()

    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {
            "name": "HRAST demo sample (synthetic, not real data)" if synthetic else Path(path).name,
            "is_synthetic": synthetic, "file": str(path),
            "raw": rep.raw_rows, "clean": rep.clean_rows, "train": len(train_df), "test": len(test_df),
            "hotels": rep.hotels, "aspects": len(rep.aspect_cols), "aspects_modelled": len(aspects),
            "cleaning": {k: v for k, v in rep.as_dict().items() if k.startswith("dropped_")},
            "columns": {"text": rep.text_col, "sentiment": rep.sentiment_col,
                        "aspect_mode": rep.aspect_mode, "hotel": rep.hotel_col},
        },
        "settings": {
            "test_size": TEST_SIZE, "random_state": RANDOM_STATE, "threshold": ASPECT_THRESHOLD,
            "tfidf": "unigrams+bigrams, min_df=2, max_df=0.95, sublinear_tf, max 60k features",
            "aspect_model": f"OneVsRest(LogisticRegression(C=4, liblinear, class_weight={aspect_class_weight}))",
            "lr_model": f"LogisticRegression(C=4, class_weight={sentiment_class_weight})",
            "svm_model": "LinearSVC(C=0.5, squared hinge, L2)",
            "preprocessing": "lowercase, punctuation/digit removal, stop-words (negations kept), lemmatisation, duplicate removal",
        },
        "sentiment_distribution": va.sentiment_distribution(df["sentiment"]),
        "aspect_model": aspect_metrics,
        "sentiment_models": sent_models,
        "best_by_accuracy": best_acc, "best_by_macro_f1": best_f1,
        "classwise_lr": classwise,
        "confusion": confusions,
        "correlation_selected": va.corr_to_payload(corr.loc[six, six]) if len(six) >= 2 else None,
        "correlation_full": va.corr_to_payload(corr),
        "top_correlated_pairs": va.top_pairs(corr),
        "aspect_frequency": freq,
        "negative_rates": neg,
        "top_terms": top_terms,
        "paper_reported": PAPER_REPORTED,
        "training_seconds": round(time.time() - t0, 1),
    }

    print("[7/7] Saving model, results and figures")
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {"vectorizer": vec, "aspect_clf": aspect_clf, "aspects": aspects, "lr": lr, "svm": svm,
              "threshold": ASPECT_THRESHOLD, "dataset": results["dataset"]["name"],
              "is_synthetic": synthetic, "trained_at": results["generated_at"]}
    joblib.dump(bundle, MODEL_FILE, compress=3)
    RESULTS_FILE.write_text(json.dumps(results, indent=2), encoding="utf-8")
    out = test_df[["text", "sentiment", "aspects"]].copy()
    out["pred_lr"] = preds["logistic_regression"]
    out["pred_svm"] = preds["linear_svm"]
    out["pred_aspects"] = [";".join(a for a, f in zip(aspects, row) if f) for row in Yhat]
    out["aspects"] = out["aspects"].map(";".join)
    if "hotel" in test_df:
        out["hotel"] = test_df["hotel"].values
    out.to_csv(ARTIFACTS_DIR / "test_predictions.csv", index=False)
    from .figures import make_figures
    make_figures(results, FIGURES_DIR)
    print(f"Done in {results['training_seconds']} s -> {ARTIFACTS_DIR}")
    return results


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", help="dataset file (csv/tsv/xlsx/json/zip)")
    ap.add_argument("--text-col")
    ap.add_argument("--sentiment-col")
    ap.add_argument("--aspect-cols", help="comma-separated 0/1 aspect columns")
    ap.add_argument("--aspect-list-col", help="single column holding a list of aspects")
    ap.add_argument("--hotel-col")
    ap.add_argument("--no-class-weight", action="store_true", help="train without class_weight='balanced'")
    a = ap.parse_args()
    overrides = {k: v for k, v in {
        "text_col": a.text_col, "sentiment_col": a.sentiment_col,
        "aspect_cols": a.aspect_cols.split(",") if a.aspect_cols else None,
        "aspect_list_col": a.aspect_list_col, "hotel_col": a.hotel_col}.items() if v}
    cw = None if a.no_class_weight else "balanced"
    train(a.data, aspect_class_weight=cw, sentiment_class_weight=cw, **overrides)


if __name__ == "__main__":
    main()
