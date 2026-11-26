"""Text preprocessing exactly as described in the paper (Algorithm 1, step 3):
lower-casing, punctuation / non-alphanumeric removal, stop-word removal,
tokenisation and lemmatisation.

One deliberate, documented deviation: negation words ("not", "no", "never",
...) are kept. Standard stop-word lists remove them, which turns
"not clean" into "clean" and flips the sentiment of the sentence.
"""
from __future__ import annotations

import re
from functools import lru_cache

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

NEGATIONS = {"no", "not", "nor", "never", "none", "nothing", "nobody", "nowhere",
             "cannot", "without", "hardly", "barely"}
# Words that carry opinion strength in hotel reviews; kept even though some
# stop-word lists drop them.
KEEP = NEGATIONS | {"very", "too", "only", "much", "more", "most", "less", "least",
                    "well", "against", "off", "down", "up", "enough", "again"}
STOP_WORDS = frozenset(w for w in ENGLISH_STOP_WORDS if w not in KEEP)

_CONTRACTIONS = {
    "n't": " not", "won't": "will not", "can't": "can not", "'re": " are",
    "'s": " is", "'d": " would", "'ll": " will", "'ve": " have", "'m": " am",
}
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_DIGITS = re.compile(r"\b\d+\b")
_SPACES = re.compile(r"\s+")


@lru_cache(maxsize=1)
def _lemmatizer():
    """WordNet lemmatiser if the NLTK data is present, otherwise a tiny
    suffix-based fallback so the project still runs offline."""
    try:
        from nltk.stem import WordNetLemmatizer
        lem = WordNetLemmatizer()
        lem.lemmatize("rooms")  # raises LookupError if wordnet data is missing
        return lem.lemmatize
    except Exception:  # pragma: no cover - depends on local NLTK data
        def simple(word: str) -> str:
            if len(word) > 4 and word.endswith("ies"):
                return word[:-3] + "y"
            if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
                return word[:-1]
            return word
        return simple


def normalise(text: str) -> str:
    """Lower-case, expand contractions, strip punctuation, digits and extra spaces."""
    text = str(text or "").lower().replace("’", "'")
    text = text.replace("wi-fi", "wifi").replace("wi fi", "wifi")
    for k, v in (("won't", "will not"), ("can't", "can not")):
        text = text.replace(k, v)
    for k, v in _CONTRACTIONS.items():
        text = text.replace(k, v)
    text = _NON_ALNUM.sub(" ", text)
    text = _DIGITS.sub(" ", text)
    return _SPACES.sub(" ", text).strip()


def clean_text(text: str) -> str:
    """Full preprocessing used before TF-IDF."""
    lemma = _lemmatizer()
    tokens = [lemma(t) for t in normalise(text).split() if t not in STOP_WORDS and len(t) > 1]
    return " ".join(tokens)


CONTRAST = re.compile(r"\b(?:but|however|although|though|whereas|yet|except)\b|[;]", re.I)


def split_clauses(text: str) -> list[str]:
    """Split a sentence at contrast markers ("..., but ...").

    Used only by the optional clause mode of the web app, which gives each
    detected aspect its own sentiment for mixed sentences. This is an
    extension beyond the paper (listed there as future work)."""
    parts = [p.strip(" ,.") for p in CONTRAST.split(str(text or ""))]
    return [p for p in parts if len(p.split()) >= 2] or [str(text or "").strip()]
