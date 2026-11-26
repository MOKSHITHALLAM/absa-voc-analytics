"""Inference with the trained bundle (used by the web API)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from .config import MODEL_FILE
from .preprocess import clean_text, split_clauses


class ModelNotTrained(RuntimeError):
    pass


def class_coefs(model) -> dict:
    """Per-class weight vectors. scikit-learn stores a single row for a
    two-class problem (weights of classes_[1]), so expand it to both classes."""
    coef = model.coef_
    if coef.shape[0] == 1:
        return {str(model.classes_[1]): coef[0], str(model.classes_[0]): -coef[0]}
    return {str(c): coef[i] for i, c in enumerate(model.classes_)}


class Predictor:
    def __init__(self, bundle: dict):
        self.b = bundle
        self.vec = bundle["vectorizer"]
        self.aspect_clf = bundle["aspect_clf"]
        self.aspects: list[str] = list(bundle["aspects"])
        self.lr = bundle["lr"]
        self.svm = bundle["svm"]
        self.threshold = float(bundle["threshold"])
        self.features = np.array(self.vec.get_feature_names_out())

    @property
    def info(self) -> dict:
        return {"dataset": self.b["dataset"], "is_synthetic": self.b["is_synthetic"],
                "trained_at": self.b["trained_at"], "aspects": self.aspects, "threshold": self.threshold}

    def _single(self, text: str) -> dict:
        clean = clean_text(text)
        X = self.vec.transform([clean])
        probs = self.aspect_clf.predict_proba(X)[0]
        order = np.argsort(probs)[::-1]
        lr_probs = self.lr.predict_proba(X)[0]
        lr_label = str(self.lr.classes_[int(np.argmax(lr_probs))])
        svm_label = str(self.svm.predict(X)[0])
        # Terms that pushed the LR model towards its prediction.
        w = class_coefs(self.lr)[lr_label]
        row = X.tocoo()
        contrib = sorted(((float(v * w[j]), self.features[j]) for j, v in zip(row.col, row.data)),
                         reverse=True)
        return {
            "clean": clean,
            "known_terms": int(X.nnz),
            "aspect_probs": [(self.aspects[i], float(probs[i])) for i in order],
            "sentiment": lr_label,
            "confidence": float(lr_probs.max()),
            "probabilities": {str(c): round(float(p), 4) for c, p in zip(self.lr.classes_, lr_probs)},
            "svm_sentiment": svm_label,
            "key_terms": [{"term": t, "weight": round(w, 3)} for w, t in contrib[:6] if w > 0],
        }

    def analyze(self, text: str, clause_mode: bool = False) -> dict:
        text = (text or "").strip()
        base = self._single(text)
        detected = [(a, p) for a, p in base["aspect_probs"] if p >= self.threshold]
        aspects = [{"aspect": a, "probability": round(p, 4), "sentiment": base["sentiment"], "source": "sentence"}
                   for a, p in detected]
        clauses = []
        if clause_mode:
            parts = split_clauses(text)
            if len(parts) > 1:
                best: dict[str, tuple[float, str, str]] = {}
                for part in parts:
                    r = self._single(part)
                    found = [(a, p) for a, p in r["aspect_probs"] if p >= self.threshold]
                    clauses.append({"text": part, "sentiment": r["sentiment"], "confidence": round(r["confidence"], 4),
                                    "aspects": [a for a, _ in found]})
                    for a, p in found:
                        if a not in best or p > best[a][0]:
                            best[a] = (p, r["sentiment"], part)
                seen = {x["aspect"] for x in aspects}
                for x in aspects:
                    if x["aspect"] in best:
                        x["sentiment"], x["source"] = best[x["aspect"]][1], "clause"
                for a, (p, s, _) in sorted(best.items(), key=lambda kv: -kv[1][0]):
                    if a not in seen:
                        aspects.append({"aspect": a, "probability": round(p, 4), "sentiment": s, "source": "clause"})
        return {
            "text": text,
            "clean_text": base["clean"],
            "sentiment": base["sentiment"],
            "confidence": round(base["confidence"], 4),
            "probabilities": base["probabilities"],
            "svm_sentiment": base["svm_sentiment"],
            "models_agree": base["sentiment"] == base["svm_sentiment"],
            "aspects": aspects,
            "top_aspect_scores": [{"aspect": a, "probability": round(p, 4)} for a, p in base["aspect_probs"][:6]],
            "key_terms": base["key_terms"],
            "low_coverage": base["known_terms"] == 0,
            "clauses": clauses,
            "threshold": self.threshold,
        }


@lru_cache(maxsize=1)
def _load(path: str, mtime: float) -> Predictor:
    return Predictor(joblib.load(path))


def get_predictor(path: Path = MODEL_FILE) -> Predictor:
    if not path.exists():
        raise ModelNotTrained("Model not trained yet. Run:  python -m ml.train")
    return _load(str(path), path.stat().st_mtime)
