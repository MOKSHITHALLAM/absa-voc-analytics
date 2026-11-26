"""Static PNG figures matching the paper's figure list (Fig. 2-6) plus
confusion matrices and the full 21x21 correlation heatmap."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402

POS, NEG, NEU, BRAND, INK, MUTED = "#1a9e8f", "#e4573d", "#8a94a6", "#2f5fd0", "#1d2433", "#5b6475"
DIVERGING = LinearSegmentedColormap.from_list("div", ["#2f5fd0", "#f4f5f7", "#e4573d"])
SEQ = LinearSegmentedColormap.from_list("seq", ["#eef2fb", "#2f5fd0", "#162e6e"])

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": "#c9ced8",
    "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED, "axes.titleweight": "bold",
    "axes.titlesize": 12, "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 150,
})


def _save(fig, path: Path) -> None:
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def _heatmap(payload: dict, path: Path, title: str, annotate: bool = True) -> None:
    names, m = payload["aspects"], np.array(payload["matrix"], dtype=float)
    size = max(5.0, 0.42 * len(names) + 2)
    fig, ax = plt.subplots(figsize=(size + 1, size))
    im = ax.imshow(np.nan_to_num(m), cmap=DIVERGING, vmin=-1, vmax=1)
    ax.set_xticks(range(len(names)), names, rotation=45, ha="right")
    ax.set_yticks(range(len(names)), names)
    if annotate:
        for i in range(len(names)):
            for j in range(len(names)):
                v = m[i, j]
                ax.text(j, i, "-" if np.isnan(v) else f"{v:.2f}", ha="center", va="center",
                        fontsize=8 if len(names) > 8 else 9, color="white" if abs(np.nan_to_num(v)) > 0.6 else INK)
    ax.spines[:].set_visible(False)
    fig.colorbar(im, ax=ax, fraction=0.04, label="Pearson (phi) r")
    ax.set_title(title)
    _save(fig, path)


def make_figures(results: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    # Fig 2 - sentiment distribution
    dist = results["sentiment_distribution"]
    fig, ax = plt.subplots(figsize=(6, 3.8))
    colors = {"positive": POS, "negative": NEG, "neutral": NEU}
    bars = ax.bar([d["sentiment"].title() for d in dist], [d["count"] for d in dist],
                  color=[colors[d["sentiment"]] for d in dist], width=0.55)
    for b, d in zip(bars, dist):
        ax.annotate(f"{d['count']:,}\n({d['percent']}%)", (b.get_x() + b.get_width() / 2, b.get_height()),
                    ha="center", va="bottom", fontsize=9, color=INK)
    ax.set_ylabel("Sentences")
    ax.set_title("Sentiment distribution of review sentences")
    ax.margins(y=0.2)
    _save(fig, out_dir / "fig2_sentiment_distribution.png")

    # Fig 3 - correlation heatmap (six selected aspects) + full matrix
    if results.get("correlation_selected"):
        _heatmap(results["correlation_selected"], out_dir / "fig3_correlation_selected.png",
                 "Correlation of selected hotel aspects")
    _heatmap(results["correlation_full"], out_dir / "fig3b_correlation_all_aspects.png",
             "Correlation of all aspect indicators", annotate=len(results["correlation_full"]["aspects"]) <= 22)

    # Fig 4 - LR vs Linear SVM
    sm = results["sentiment_models"]
    metrics = ["accuracy", "macro_precision", "macro_recall", "macro_f1"]
    x = np.arange(len(metrics))
    fig, ax = plt.subplots(figsize=(7, 3.8))
    for k, (name, col, lab) in enumerate((("logistic_regression", BRAND, "Logistic Regression"),
                                           ("linear_svm", "#c08a1e", "Linear SVM"))):
        vals = [sm[name][m] for m in metrics]
        bs = ax.bar(x + (k - 0.5) * 0.36, vals, 0.34, label=lab, color=col)
        for b, v in zip(bs, vals):
            ax.annotate(f"{v:.3f}", (b.get_x() + b.get_width() / 2, v), ha="center", va="bottom", fontsize=8)
    ax.set_xticks(x, ["Accuracy", "Macro precision", "Macro recall", "Macro F1"])
    ax.set_ylim(0, 1.12)
    ax.legend(frameon=False, loc="upper right", ncols=2)
    ax.set_title("Sentiment classifiers: Logistic Regression vs Linear SVM")
    _save(fig, out_dir / "fig4_model_comparison.png")

    # Fig 5 - top 5 aspect frequency
    top = results["aspect_frequency"][:5]
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    bs = ax.barh([t["aspect"] for t in top][::-1], [t["count"] for t in top][::-1], color=BRAND, height=0.55)
    for b, t in zip(bs, top[::-1]):
        ax.annotate(f" {t['count']:,} ({t['percent']}%)", (b.get_width(), b.get_y() + b.get_height() / 2),
                    va="center", fontsize=9)
    ax.set_xlabel("Sentences mentioning the aspect")
    ax.set_title("Five most frequently discussed aspects")
    ax.margins(x=0.25)
    _save(fig, out_dir / "fig5_aspect_frequency.png")

    # Fig 6 - negative sentiment rate
    neg = results["negative_rates"][:8]
    fig, ax = plt.subplots(figsize=(6.5, 4))
    bs = ax.barh([n["aspect"] for n in neg][::-1], [n["negative_rate"] for n in neg][::-1], color=NEG, height=0.55)
    for b, n in zip(bs, neg[::-1]):
        ax.annotate(f" {n['negative_rate']}% of {n['total']:,}", (b.get_width(), b.get_y() + b.get_height() / 2),
                    va="center", fontsize=9)
    ax.set_xlim(0, 118)
    ax.set_xlabel("Negative sentiment rate (%)")
    ax.set_title("Aspects with the highest negative sentiment rate")
    _save(fig, out_dir / "fig6_negative_rates.png")

    # Confusion matrices
    for name, title in (("logistic_regression", "Logistic Regression"), ("linear_svm", "Linear SVM")):
        cm = results["confusion"][name]
        m = np.array(cm["matrix"])
        fig, ax = plt.subplots(figsize=(4.4, 3.8))
        ax.imshow(m, cmap=SEQ)
        labs = [l.title() for l in cm["labels"]]
        ax.set_xticks(range(len(labs)), labs)
        ax.set_yticks(range(len(labs)), labs)
        for i in range(len(labs)):
            for j in range(len(labs)):
                ax.text(j, i, f"{m[i, j]:,}", ha="center", va="center",
                        color="white" if m[i, j] > m.max() * 0.55 else INK)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.spines[:].set_visible(False)
        ax.set_title(f"Confusion matrix - {title}")
        _save(fig, out_dir / f"confusion_{name}.png")
