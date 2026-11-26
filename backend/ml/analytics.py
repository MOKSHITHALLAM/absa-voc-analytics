"""Voice of Customer analytics from the paper (Sections F, G, H):
Pearson (phi) correlation between binary aspect indicators, aspect frequency
and aspect-wise negative sentiment rate NR_a = N_negative,a / N_total,a.
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

import numpy as np
import pandas as pd


def aspect_matrix(aspect_lists: Iterable[list[str]], aspects: list[str]) -> pd.DataFrame:
    lists = list(aspect_lists)
    data = np.zeros((len(lists), len(aspects)), dtype=np.int8)
    index = {a: i for i, a in enumerate(aspects)}
    for r, lst in enumerate(lists):
        for a in lst:
            if a in index:
                data[r, index[a]] = 1
    return pd.DataFrame(data, columns=aspects)


def phi_correlation(matrix: pd.DataFrame) -> pd.DataFrame:
    """Pearson correlation of binary columns (= phi coefficient). Columns with
    zero variance get NaN off-diagonal and 1.0 on the diagonal."""
    corr = matrix.astype(float).corr(method="pearson")
    for c in corr.columns:
        corr.loc[c, c] = 1.0
    return corr


def sentiment_distribution(sentiments: Iterable[str]) -> list[dict]:
    counts = Counter(sentiments)
    total = sum(counts.values()) or 1
    return [{"sentiment": s, "count": counts.get(s, 0),
             "percent": round(100 * counts.get(s, 0) / total, 2)}
            for s in ("positive", "negative", "neutral")]


def aspect_frequency(aspect_lists: Iterable[list[str]], total_sentences: int | None = None) -> list[dict]:
    lists = list(aspect_lists)
    total = total_sentences or len(lists) or 1
    counts = Counter(a for lst in lists for a in lst)
    return [{"aspect": a, "count": n, "percent": round(100 * n / total, 2)}
            for a, n in counts.most_common()]


def negative_rates(aspect_lists: Iterable[list[str]], sentiments: Iterable[str],
                   min_total: int = 1) -> list[dict]:
    totals, negs, poss, neus = Counter(), Counter(), Counter(), Counter()
    for lst, s in zip(aspect_lists, sentiments):
        for a in lst:
            totals[a] += 1
            if s == "negative":
                negs[a] += 1
            elif s == "positive":
                poss[a] += 1
            else:
                neus[a] += 1
    rows = [{"aspect": a, "total": t, "negative": negs[a], "positive": poss[a], "neutral": neus[a],
             "negative_rate": round(100 * negs[a] / t, 2)}
            for a, t in totals.items() if t >= min_total]
    return sorted(rows, key=lambda r: (-r["negative_rate"], -r["total"]))


def corr_to_payload(corr: pd.DataFrame) -> dict:
    vals = corr.round(3).replace({np.nan: None}).values.tolist()
    return {"aspects": list(corr.columns), "matrix": vals}


def top_pairs(corr: pd.DataFrame, k: int = 8) -> list[dict]:
    pairs = []
    cols = list(corr.columns)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            v = corr.iloc[i, j]
            if pd.notna(v):
                pairs.append({"a": cols[i], "b": cols[j], "r": round(float(v), 3)})
    pairs.sort(key=lambda p: -abs(p["r"]))
    return pairs[:k]
