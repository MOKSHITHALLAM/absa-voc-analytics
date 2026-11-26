"""Shared constants and paths."""
from __future__ import annotations

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"          # put the real HRAST file here
DEMO_DIR = DATA_DIR / "demo"
DEMO_FILE = DEMO_DIR / "DEMO_SYNTHETIC_hrast_format.csv"
ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
FIGURES_DIR = ARTIFACTS_DIR / "figures"
MODEL_FILE = ARTIFACTS_DIR / "model.joblib"
RESULTS_FILE = ARTIFACTS_DIR / "results.json"

# Experimental settings taken from the paper.
TEST_SIZE = 0.20
RANDOM_STATE = 42
ASPECT_THRESHOLD = 0.50
SENTIMENTS = ["positive", "negative", "neutral"]

# The 21 hotel aspects listed in the team report (Appendix A). The real HRAST
# column names are used whenever the dataset provides them; this list is only
# used to build the synthetic demo sample.
DEFAULT_ASPECTS = [
    "Room", "Location", "Staff", "Cleanliness", "Facilities/Amenities", "Comfort",
    "Bed", "Bathroom/Shower", "Noise", "Wi-Fi", "Lift", "Breakfast/Food",
    "Value for Money", "Check-in/Check-out", "Air Conditioning/Heating", "Parking",
    "Security", "View", "Lobby/Common Areas", "Accessibility", "General Experience",
]

# Six aspects used for the correlation table / heatmap in the paper (Table III).
PAPER_CORRELATION_ASPECTS = ["Comfort", "Bed", "Room", "Cleanliness", "Location", "Staff"]

# Numbers reported in the paper, shown next to the reproduced values so the
# two can be compared honestly. They are never used as our own results.
PAPER_REPORTED = {
    "dataset": {"raw": 23113, "clean": 23024, "train": 18419, "test": 4605, "hotels": 42},
    "sentiment_distribution": {"positive": 11747, "negative": 10488, "neutral": 789},
    "aspect_model": {
        "subset_accuracy": 0.6074, "micro_precision": 0.8034, "micro_recall": 0.8918,
        "micro_f1": 0.8453, "macro_f1": 0.8474, "hamming_loss": 0.0250,
    },
    "sentiment_models": {
        "logistic_regression": {"accuracy": 0.8929, "macro_precision": 0.7004,
                                "macro_recall": 0.7439, "macro_f1": 0.7132},
        "linear_svm": {"accuracy": 0.9155, "macro_precision": 0.7185,
                       "macro_recall": 0.6969, "macro_f1": 0.7051},
    },
}
