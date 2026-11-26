"""Database tables: users, reviews, review_aspects, training_runs."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="analyst")  # admin | analyst
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    reviews: Mapped[list["Review"]] = relationship(back_populates="user")


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    clean_text: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(20), index=True)  # manual | voice | batch | dataset
    hotel: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    sentiment: Mapped[str] = mapped_column(String(10), index=True)      # Logistic Regression prediction
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    svm_sentiment: Mapped[str] = mapped_column(String(10))
    probabilities: Mapped[dict] = mapped_column(JSON, default=dict)
    key_terms: Mapped[list] = mapped_column(JSON, default=list)
    clause_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    true_sentiment: Mapped[str | None] = mapped_column(String(10), nullable=True)  # gold label (dataset rows)
    true_aspects: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    user: Mapped[User | None] = relationship(back_populates="reviews")
    aspects: Mapped[list["ReviewAspect"]] = relationship(back_populates="review", cascade="all, delete-orphan",
                                                         lazy="selectin")


class ReviewAspect(Base):
    __tablename__ = "review_aspects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    aspect: Mapped[str] = mapped_column(String(80), index=True)
    probability: Mapped[float] = mapped_column(Float)
    sentiment: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(10), default="sentence")  # sentence | clause
    review: Mapped[Review] = relationship(back_populates="aspects")


class TrainingRun(Base):
    __tablename__ = "training_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset: Mapped[str] = mapped_column(String(200))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[str] = mapped_column(String(40), unique=True)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
