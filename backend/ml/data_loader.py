"""Load the HRAST dataset (or any file in the same shape) into a standard frame.

The Kaggle file layout is detected automatically:
  * text column      - the column with the longest strings (or --text-col)
  * sentiment column - values like positive/negative/neutral (or --sentiment-col)
  * aspect labels    - either many 0/1 columns (one per aspect) or one column
                       holding a delimited list such as "room; staff"
Every choice can be overridden from the command line; run
``python -m ml.inspect_data <file>`` to see what was detected.

Output columns: ``text``, ``sentiment`` (positive/negative/neutral),
``aspects`` (list[str]) and optionally ``hotel``.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

SENTIMENT_MAP = {
    "positive": "positive", "pos": "positive", "p": "positive", "+": "positive",
    "negative": "negative", "neg": "negative", "n": "negative", "-": "negative",
    "neutral": "neutral", "neu": "neutral", "0": "neutral", "none": "neutral",
    "1": "positive", "-1": "negative", "1.0": "positive", "-1.0": "negative", "0.0": "neutral",
}
TEXT_HINTS = ("sentence", "text", "review", "comment", "content")
SENT_HINTS = ("sentiment", "polarity", "label", "class")
ASPECT_HINTS = ("aspect", "category", "categories")
HOTEL_HINTS = ("hotel", "property", "hotel_name", "hotel_id")


@dataclass
class LoadReport:
    path: str
    raw_rows: int
    text_col: str
    sentiment_col: str
    aspect_mode: str
    aspect_cols: list[str] = field(default_factory=list)
    hotel_col: str | None = None
    dropped_missing: int = 0
    dropped_bad_sentiment: int = 0
    dropped_no_aspect: int = 0
    dropped_duplicates: int = 0
    clean_rows: int = 0
    hotels: int | None = None

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def read_any(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    if suffix == ".json":
        return pd.read_json(path)
    if suffix in (".tsv", ".txt"):
        return pd.read_csv(path, sep="\t")
    if suffix == ".zip":
        import zipfile
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith((".csv", ".tsv", ".xlsx"))]
            if not names:
                raise ValueError("The zip file contains no CSV/TSV/XLSX file.")
            names.sort(key=lambda n: zf.getinfo(n).file_size, reverse=True)
            with zf.open(names[0]) as fh:
                if names[0].lower().endswith(".xlsx"):
                    return pd.read_excel(fh)
                return pd.read_csv(fh, sep="\t" if names[0].lower().endswith(".tsv") else ",")
    return pd.read_csv(path, sep=None, engine="python", encoding_errors="replace")


def _is_binary(series: pd.Series) -> bool:
    vals = set(pd.Series(series).dropna().astype(str).str.strip().str.lower().unique())
    return bool(vals) and vals <= {"0", "1", "0.0", "1.0", "true", "false", "yes", "no"}


def _find(cols: list[str], hints: tuple[str, ...]) -> str | None:
    low = {c.lower().strip(): c for c in cols}
    for h in hints:
        for lc, c in low.items():
            if lc == h:
                return c
    for h in hints:
        for lc, c in low.items():
            if h in lc:
                return c
    return None


def map_sentiment(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return SENTIMENT_MAP.get(str(value).strip().lower())


def _parse_aspect_list(value) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "[]"):
        return []
    if s.startswith("[") and s.endswith("]"):
        try:
            return [str(x).strip() for x in ast.literal_eval(s) if str(x).strip()]
        except (ValueError, SyntaxError):
            s = s.strip("[]")
    return [p.strip().strip("'\"") for p in re.split(r"[;,|]", s) if p.strip().strip("'\"")]


def detect_columns(df: pd.DataFrame, text_col=None, sentiment_col=None,
                   aspect_cols=None, aspect_list_col=None, hotel_col=None) -> dict:
    cols = list(df.columns)
    if text_col is None:
        text_col = _find(cols, TEXT_HINTS)
        if text_col is None:
            obj = [c for c in cols if df[c].dtype == object]
            text_col = max(obj, key=lambda c: df[c].astype(str).str.len().mean())
    if sentiment_col is None:
        candidates = [c for c in cols if c != text_col]
        best, best_share = None, 0.0
        for c in candidates:
            if _is_binary(df[c]):  # 0/1 columns are aspect flags, not sentiment
                continue
            share = df[c].map(map_sentiment).notna().mean()
            if share > best_share and df[c].nunique() <= 6:
                best, best_share = c, share
        named = _find(candidates, SENT_HINTS)
        if named is not None and df[named].map(map_sentiment).notna().mean() > 0.5:
            best = named
        if best is None or (best != named and best_share < 0.5):
            raise ValueError("Could not find the sentiment column; pass --sentiment-col.")
        sentiment_col = best
    if hotel_col is None:
        hotel_col = _find([c for c in cols if c not in (text_col, sentiment_col)], HOTEL_HINTS)

    if aspect_cols:
        mode = "binary"
    elif aspect_list_col:
        mode = "list"
    else:
        skip = {text_col, sentiment_col, hotel_col}
        binary = [c for c in cols if c not in skip and _is_binary(df[c])]
        if len(binary) >= 2:
            mode, aspect_cols = "binary", binary
        else:
            aspect_list_col = _find([c for c in cols if c not in skip], ASPECT_HINTS)
            if aspect_list_col is None:
                raise ValueError("Could not find aspect labels; pass --aspect-cols or --aspect-list-col.")
            mode = "list"
    return {"text_col": text_col, "sentiment_col": sentiment_col, "hotel_col": hotel_col,
            "aspect_mode": mode, "aspect_cols": list(aspect_cols or []),
            "aspect_list_col": aspect_list_col}


def load_dataset(path: str | Path, **overrides) -> tuple[pd.DataFrame, LoadReport]:
    """Load + validate + de-duplicate. Mirrors the paper's preprocessing audit:
    missing values, invalid sentiment labels, rows without a usable aspect label
    and duplicate cleaned sentences are removed."""
    from .preprocess import clean_text

    raw = read_any(path)
    det = detect_columns(raw, **overrides)
    rep = LoadReport(path=str(path), raw_rows=len(raw), text_col=det["text_col"],
                     sentiment_col=det["sentiment_col"], aspect_mode=det["aspect_mode"],
                     hotel_col=det["hotel_col"])

    df = pd.DataFrame({"text": raw[det["text_col"]].astype(str).str.strip()})
    df["sentiment"] = raw[det["sentiment_col"]].map(map_sentiment)
    if det["aspect_mode"] == "binary":
        acols = det["aspect_cols"]
        rep.aspect_cols = acols
        flags = raw[acols].astype(str).apply(lambda s: s.str.strip().str.lower().isin(["1", "1.0", "true", "yes"]))
        df["aspects"] = [[a for a, f in zip(acols, row) if f] for row in flags.itertuples(index=False)]
    else:
        df["aspects"] = raw[det["aspect_list_col"]].map(_parse_aspect_list)
        names = sorted({a for lst in df["aspects"] for a in lst})
        rep.aspect_cols = names
    if det["hotel_col"]:
        df["hotel"] = raw[det["hotel_col"]].astype(str)

    before = len(df)
    df = df[df["text"].str.len() > 0]
    df = df[~df["text"].str.lower().isin(["nan", "none"])]
    rep.dropped_missing = before - len(df)
    before = len(df)
    df = df[df["sentiment"].notna()]
    rep.dropped_bad_sentiment = before - len(df)
    before = len(df)
    df = df[df["aspects"].map(len) > 0]
    rep.dropped_no_aspect = before - len(df)

    df = df.copy()
    df["clean"] = df["text"].map(clean_text)
    df = df[df["clean"].str.len() > 0]
    before = len(df)
    df = df.drop_duplicates(subset="clean", keep="first")
    rep.dropped_duplicates = before - len(df)
    df = df.reset_index(drop=True)
    rep.clean_rows = len(df)
    if "hotel" in df:
        rep.hotels = int(df["hotel"].nunique())
    # Keep only aspects that still occur after cleaning, in the dataset's order.
    present = {a for lst in df["aspects"] for a in lst}
    rep.aspect_cols = [a for a in rep.aspect_cols if a in present]
    return df, rep
