"""Show what the loader detects in a dataset file.

Usage:  python -m ml.inspect_data data/raw/<your-hrast-file>.csv
"""
from __future__ import annotations

import sys

from .data_loader import detect_columns, load_dataset, read_any


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    raw = read_any(path)
    print(f"File: {path}\nRows: {len(raw)}\nColumns ({len(raw.columns)}):")
    for c in raw.columns:
        print(f"  - {c!r:40} dtype={raw[c].dtype}, unique={raw[c].nunique()}, e.g. {str(raw[c].iloc[0])[:50]!r}")
    det = detect_columns(raw)
    print("\nDetected:")
    for k, v in det.items():
        print(f"  {k}: {v}")
    df, rep = load_dataset(path)
    print("\nAfter cleaning:")
    for k, v in rep.as_dict().items():
        if k != "aspect_cols":
            print(f"  {k}: {v}")
    print(f"  aspects ({len(rep.aspect_cols)}): {rep.aspect_cols}")
    print("\nSentiment counts:\n" + df["sentiment"].value_counts().to_string())


if __name__ == "__main__":
    main()
