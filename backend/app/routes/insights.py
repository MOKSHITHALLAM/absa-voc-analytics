"""Reviews, dashboard, research results and system endpoints."""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ml.predictor import ModelNotTrained, get_predictor

from .. import speech
from ..db import db_label, get_db
from ..models import Review, ReviewAspect, TrainingRun, User
from ..security import admin_user, current_user
from ..services import (dashboard, filtered_reviews, load_results, reset_reviews, review_to_dict,
                        seed_reviews)

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        info = get_predictor().info
    except ModelNotTrained:
        info = None
    return {"status": "ok", "database": db_label(), "reviews": db.scalar(select(func.count(Review.id))),
            "model": info, "speech_available": speech.available()}


@router.get("/reviews")
def list_reviews(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                 q: str | None = None, sentiment: str | None = None, aspect: str | None = None,
                 source: str | None = None, hotel: str | None = None,
                 db: Session = Depends(get_db), _: User = Depends(current_user)):
    stmt = filtered_reviews(db, source=source, hotel=hotel, sentiment=sentiment, aspect=aspect, q=q)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Review.id.desc()).offset((page - 1) * size).limit(size)).all()
    return {"total": total, "page": page, "size": size, "items": [review_to_dict(r) for r in rows]}


@router.get("/reviews/export.csv")
def export_reviews(source: str | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.scalars(filtered_reviews(db, source=source).order_by(Review.id)).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "created_at", "source", "hotel", "text", "sentiment_lr", "confidence", "sentiment_svm",
                "aspects", "aspect_sentiments", "true_sentiment", "true_aspects"])
    for r in rows:
        w.writerow([r.id, r.created_at, r.source, r.hotel or "", r.text, r.sentiment, r.confidence, r.svm_sentiment,
                    ";".join(a.aspect for a in r.aspects), ";".join(f"{a.aspect}:{a.sentiment}" for a in r.aspects),
                    r.true_sentiment or "", r.true_aspects or ""])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=voc_reviews.csv"})


@router.get("/reviews/{review_id}")
def get_review(review_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    r = db.get(Review, review_id)
    if r is None:
        raise HTTPException(404, "Review not found.")
    return review_to_dict(r, full=True)


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = db.get(Review, review_id)
    if r is None:
        raise HTTPException(404, "Review not found.")
    if user.role != "admin" and r.user_id != user.id:
        raise HTTPException(403, "You can only delete reviews you added.")
    db.delete(r)
    db.commit()


@router.get("/filters")
def filters(db: Session = Depends(get_db), _: User = Depends(current_user)):
    hotels = [h for h in db.scalars(select(distinct(Review.hotel)).where(Review.hotel.is_not(None))) if h]
    aspects = sorted(db.scalars(select(distinct(ReviewAspect.aspect))).all())
    try:
        model_aspects = get_predictor().aspects
    except ModelNotTrained:
        model_aspects = []
    return {"hotels": sorted(hotels), "aspects": model_aspects or aspects,
            "sources": ["dataset", "manual", "voice", "batch"]}


@router.get("/dashboard")
def get_dashboard(source: str | None = None, hotel: str | None = None,
                  db: Session = Depends(get_db), _: User = Depends(current_user)):
    return dashboard(db, source=source or None, hotel=hotel or None)


@router.get("/research")
def research(db: Session = Depends(get_db), _: User = Depends(current_user)):
    res = load_results()
    if res is None:
        raise HTTPException(503, "No training results yet. Run:  python -m ml.train")
    runs = db.scalars(select(TrainingRun).order_by(TrainingRun.id.desc()).limit(10)).all()
    res["runs"] = [{"id": r.id, "dataset": r.dataset, "is_synthetic": r.is_synthetic,
                    "generated_at": r.generated_at, "summary": r.summary} for r in runs]
    return res


@router.post("/admin/reseed")
def reseed(db: Session = Depends(get_db), _: User = Depends(admin_user)):
    """Remove all stored reviews and re-import held-out test sentences."""
    removed = reset_reviews(db)
    added = seed_reviews(db)
    return {"removed": removed, "added": added}
