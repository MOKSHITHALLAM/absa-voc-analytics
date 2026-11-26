"""Business logic shared by the routes."""
from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ml import analytics as va
from ml.config import ARTIFACTS_DIR, RESULTS_FILE
from ml.predictor import ModelNotTrained, get_predictor

from .config import ADMIN_EMAIL, ADMIN_PASSWORD, SEED_LIMIT
from .models import Review, ReviewAspect, TrainingRun, User
from .security import hash_password

log = logging.getLogger("voc.services")


def load_results() -> dict | None:
    if not RESULTS_FILE.exists():
        return None
    return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))


def store_analysis(db: Session, result: dict, source: str, user: User | None = None,
                   hotel: str | None = None, clause_mode: bool = False,
                   true_sentiment: str | None = None, true_aspects: str | None = None,
                   commit: bool = True) -> Review:
    review = Review(
        user_id=user.id if user else None, text=result["text"], clean_text=result["clean_text"],
        source=source, hotel=(hotel or None), sentiment=result["sentiment"], confidence=result["confidence"],
        svm_sentiment=result["svm_sentiment"], probabilities=result["probabilities"],
        key_terms=result["key_terms"], clause_mode=clause_mode,
        true_sentiment=true_sentiment, true_aspects=true_aspects,
    )
    review.aspects = [ReviewAspect(aspect=a["aspect"], probability=a["probability"], sentiment=a["sentiment"],
                                   source=a.get("source", "sentence")) for a in result["aspects"]]
    db.add(review)
    if commit:
        db.commit()
        db.refresh(review)
    return review


def review_to_dict(r: Review, full: bool = False) -> dict:
    d = {
        "id": r.id, "text": r.text, "source": r.source, "hotel": r.hotel, "sentiment": r.sentiment,
        "confidence": r.confidence, "svm_sentiment": r.svm_sentiment,
        "aspects": [{"aspect": a.aspect, "probability": a.probability, "sentiment": a.sentiment,
                     "source": a.source} for a in r.aspects],
        "true_sentiment": r.true_sentiment,
        "true_aspects": [a for a in (r.true_aspects or "").split(";") if a],
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
        "user": r.user.name if r.user else None,
    }
    if full:
        d.update({"clean_text": r.clean_text, "probabilities": r.probabilities, "key_terms": r.key_terms,
                  "clause_mode": r.clause_mode})
    return d


def ensure_admin(db: Session) -> None:
    if db.scalar(select(User).where(User.email == ADMIN_EMAIL)) is None:
        db.add(User(name="Admin", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role="admin"))
        db.commit()


def record_training_run(db: Session) -> None:
    res = load_results()
    if not res or db.scalar(select(TrainingRun).where(TrainingRun.generated_at == res["generated_at"])):
        return
    summary = {"aspect_model": {k: v for k, v in res["aspect_model"].items() if k != "per_aspect"},
               "sentiment_models": res["sentiment_models"],
               "clean": res["dataset"]["clean"], "test": res["dataset"]["test"]}
    db.add(TrainingRun(dataset=res["dataset"]["name"], is_synthetic=res["dataset"]["is_synthetic"],
                       generated_at=res["generated_at"], summary=summary))
    db.commit()


def seed_reviews(db: Session) -> int:
    """Fill an empty database with held-out TEST sentences (never training
    sentences) analysed by the current model, keeping their gold labels."""
    if db.scalar(select(func.count(Review.id))):
        return 0
    path = ARTIFACTS_DIR / "test_predictions.csv"
    if not path.exists():
        return 0
    try:
        predictor = get_predictor()
    except ModelNotTrained:
        return 0
    df = pd.read_csv(path).fillna("")
    df = df.sample(n=min(SEED_LIMIT, len(df)), random_state=7)
    for row in df.itertuples(index=False):
        res = predictor.analyze(str(row.text))
        store_analysis(db, res, source="dataset", hotel=getattr(row, "hotel", "") or None,
                       true_sentiment=row.sentiment, true_aspects=row.aspects, commit=False)
    db.commit()
    log.info("Seeded %d test-set reviews", len(df))
    return len(df)


def reset_reviews(db: Session) -> int:
    n = db.query(Review).count()
    db.query(ReviewAspect).delete()
    db.query(Review).delete()
    db.commit()
    return n


def filtered_reviews(db: Session, source: str | None = None, hotel: str | None = None,
                     sentiment: str | None = None, aspect: str | None = None, q: str | None = None):
    stmt = select(Review)
    if source:
        stmt = stmt.where(Review.source == source)
    if hotel:
        stmt = stmt.where(Review.hotel == hotel)
    if sentiment:
        stmt = stmt.where(Review.sentiment == sentiment)
    if aspect:
        stmt = stmt.where(Review.id.in_(select(ReviewAspect.review_id).where(ReviewAspect.aspect == aspect)))
    if q:
        stmt = stmt.where(Review.text.ilike(f"%{q}%"))
    return stmt


def dashboard(db: Session, source: str | None = None, hotel: str | None = None) -> dict:
    reviews = db.scalars(filtered_reviews(db, source=source, hotel=hotel)).all()
    total = len(reviews)
    sentiments = [r.sentiment for r in reviews]
    aspect_lists = [[a.aspect for a in r.aspects] for r in reviews]
    # Aspect-level sentiment (clause mode may assign different polarities).
    per_aspect = defaultdict(Counter)
    for r in reviews:
        for a in r.aspects:
            per_aspect[a.aspect][a.sentiment] += 1
    neg_rates = []
    for a, c in per_aspect.items():
        t = sum(c.values())
        neg_rates.append({"aspect": a, "total": t, "negative": c["negative"], "positive": c["positive"],
                          "neutral": c["neutral"], "negative_rate": round(100 * c["negative"] / t, 2)})
    min_support = 5 if total >= 100 else 1
    pain = sorted([n for n in neg_rates if n["total"] >= min_support],
                  key=lambda n: (-n["negative_rate"], -n["total"]))
    strengths = sorted([n for n in neg_rates if n["total"] >= min_support],
                       key=lambda n: (-(n["positive"] / n["total"]), -n["total"]))
    by_hotel = defaultdict(Counter)
    for r in reviews:
        if r.hotel:
            by_hotel[r.hotel][r.sentiment] += 1
    hotels = sorted(({"hotel": h, "total": sum(c.values()), "positive": c["positive"], "negative": c["negative"],
                      "neutral": c["neutral"]} for h, c in by_hotel.items()), key=lambda x: -x["total"])
    labelled = [r for r in reviews if r.true_sentiment]
    agree = sum(r.sentiment == r.svm_sentiment for r in reviews)
    sources = Counter(r.source for r in reviews)
    co = va.aspect_matrix(aspect_lists, [x["aspect"] for x in va.aspect_frequency(aspect_lists)][:8]) \
        if total else None
    corr = va.phi_correlation(co) if co is not None and co.shape[1] >= 2 else None
    recent = sorted(reviews, key=lambda r: r.id, reverse=True)[:6]
    return {
        "total_reviews": total,
        "total_aspect_mentions": sum(len(l) for l in aspect_lists),
        "no_aspect_reviews": sum(1 for l in aspect_lists if not l),
        "sentiment_distribution": va.sentiment_distribution(sentiments),
        "aspect_frequency": va.aspect_frequency(aspect_lists, total)[:21],
        "negative_rates": sorted(neg_rates, key=lambda n: -n["total"]),
        "pain_points": pain[:5],
        "strengths": [s for s in strengths if s["positive"] > 0][:5],
        "hotels": hotels[:12],
        "sources": dict(sources),
        "model_agreement": round(100 * agree / total, 1) if total else None,
        "gold_accuracy": round(100 * sum(r.sentiment == r.true_sentiment for r in labelled) / len(labelled), 1)
        if labelled else None,
        "gold_count": len(labelled),
        "correlation": va.corr_to_payload(corr) if corr is not None else None,
        "recent": [review_to_dict(r) for r in recent],
        "min_support": min_support,
    }
