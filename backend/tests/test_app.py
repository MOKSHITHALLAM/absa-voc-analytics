"""API and ML tests. Run from the backend folder:  pytest -q"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["SEED_LIMIT"] = "60"

import pandas as pd  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from ml import analytics as va  # noqa: E402
from ml.config import MODEL_FILE  # noqa: E402
from ml.data_loader import detect_columns, load_dataset, map_sentiment  # noqa: E402
from ml.preprocess import clean_text, split_clauses  # noqa: E402

if not MODEL_FILE.exists():  # train on the demo sample if needed
    from ml.train import train
    train()

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def token(client):
    r = client.post("/api/auth/login", json={"email": "admin@vocanalytics.app", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- preprocessing / loader ----------
def test_clean_text_keeps_negation_and_lemmatises():
    out = clean_text("The rooms were NOT clean!!! 5 stars?")
    assert "not" in out.split() and "clean" in out.split()
    assert "5" not in out and "!" not in out


def test_split_clauses():
    assert len(split_clauses("Staff were lovely but the wifi was awful")) == 2
    assert split_clauses("Nice room") == ["Nice room"]


def test_map_sentiment_variants():
    assert map_sentiment("Positive") == "positive"
    assert map_sentiment("neg") == "negative"
    assert map_sentiment(-1) == "negative"
    assert map_sentiment("weird") is None


def test_detect_binary_aspect_columns():
    df = pd.DataFrame({"sentence": ["nice room here", "rude staff today"], "sentiment": ["Positive", "Negative"],
                       "Room": [1, 0], "Staff": [0, 1]})
    d = detect_columns(df)
    assert d["text_col"] == "sentence" and d["sentiment_col"] == "sentiment"
    assert d["aspect_mode"] == "binary" and d["aspect_cols"] == ["Room", "Staff"]


def test_detect_list_aspect_column(tmp_path):
    p = tmp_path / "x.csv"
    pd.DataFrame({"review": ["great breakfast and staff", "dirty room", "dirty room", "ok"],
                  "polarity": ["pos", "neg", "neg", "neu"],
                  "aspects": ["food; staff", "room", "room", ""]}).to_csv(p, index=False)
    df, rep = load_dataset(p)
    assert rep.aspect_mode == "list"
    assert rep.dropped_duplicates == 1 and rep.dropped_no_aspect == 1
    assert df.iloc[0]["aspects"] == ["food", "staff"]


# ---------- analytics ----------
def test_phi_correlation_and_rates():
    lists = [["A", "B"], ["A", "B"], ["C"], ["A"]]
    corr = va.phi_correlation(va.aspect_matrix(lists, ["A", "B", "C"]))
    assert corr.loc["A", "A"] == 1.0
    assert corr.loc["A", "B"] > 0 > corr.loc["A", "C"]
    rates = va.negative_rates(lists, ["negative", "negative", "positive", "positive"])
    b = next(r for r in rates if r["aspect"] == "B")
    assert b["negative_rate"] == 100.0 and b["total"] == 2
    freq = va.aspect_frequency(lists)
    assert freq[0] == {"aspect": "A", "count": 3, "percent": 75.0}


# ---------- API ----------
def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["model"]["aspects"]


def test_auth_required(client):
    assert client.get("/api/dashboard").status_code == 401


def test_register_and_login(client):
    r = client.post("/api/auth/register", json={"name": "Test User", "email": "t@example.com", "password": "secret1"})
    assert r.status_code == 201
    assert client.post("/api/auth/register", json={"name": "Test User", "email": "t@example.com",
                                                   "password": "secret1"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "t@example.com", "password": "nope"}).status_code == 401


def test_analyze_and_store(client, token):
    r = client.post("/api/analyze", json={"text": "Breakfast was cold and the wifi kept dropping",
                                          "clause_mode": False}, headers=H(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sentiment"] in {"positive", "negative", "neutral"}
    assert set(body["probabilities"]) <= {"positive", "negative", "neutral"}
    assert "review_id" in body
    detail = client.get(f"/api/reviews/{body['review_id']}", headers=H(token)).json()
    assert detail["source"] == "manual"


def test_clause_mode_gives_mixed_aspects(client, token):
    r = client.post("/api/analyze", json={"text": "The staff were lovely but the wifi was awful",
                                          "clause_mode": True, "save": False}, headers=H(token)).json()
    assert len(r["clauses"]) == 2


def test_analyze_validation(client, token):
    assert client.post("/api/analyze", json={"text": "ok"}, headers=H(token)).status_code == 422


def test_batch_upload(client, token):
    csv = "review,hotel\nThe room was dirty,H1\nGreat location near the metro,H2\nx\n"
    r = client.post("/api/analyze/batch", files={"file": ("r.csv", csv, "text/csv")}, headers=H(token))
    assert r.status_code == 200, r.text
    assert r.json()["processed"] == 2


def test_voice_rejects_non_audio(client, token):
    r = client.post("/api/voice", files={"audio": ("a.webm", b"not audio at all", "audio/webm")}, headers=H(token))
    assert r.status_code in (415, 503)


def test_dashboard_and_reviews(client, token):
    d = client.get("/api/dashboard", headers=H(token)).json()
    assert d["total_reviews"] >= 60
    assert sum(x["count"] for x in d["sentiment_distribution"]) == d["total_reviews"]
    assert d["gold_count"] >= 60
    lst = client.get("/api/reviews?size=5&sentiment=negative", headers=H(token)).json()
    assert all(i["sentiment"] == "negative" for i in lst["items"])
    assert client.get("/api/reviews/export.csv", headers=H(token)).text.startswith("id,")


def test_research(client, token):
    r = client.get("/api/research", headers=H(token)).json()
    assert {"aspect_model", "sentiment_models", "correlation_full", "negative_rates"} <= set(r)
    assert r["dataset"]["train"] + r["dataset"]["test"] == r["dataset"]["clean"]
    assert client.get("/figures/fig2_sentiment_distribution.png").status_code == 200


def test_delete_permissions(client, token):
    other = client.post("/api/auth/register", json={"name": "Other", "email": "o@example.com",
                                                    "password": "secret1"}).json()["access_token"]
    rid = client.post("/api/analyze", json={"text": "Lovely view from the balcony"}, headers=H(token)).json()["review_id"]
    assert client.delete(f"/api/reviews/{rid}", headers=H(other)).status_code == 403
    assert client.delete(f"/api/reviews/{rid}", headers=H(token)).status_code == 204
