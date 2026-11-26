"""Database engine and session. SQLite by default; set DATABASE_URL for MySQL
(e.g. mysql+pymysql://user:pass@localhost:3306/voc_analytics)."""
from __future__ import annotations

import logging

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL, STORAGE_DIR

log = logging.getLogger("voc.db")


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    kwargs = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    eng = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _fk(dbapi_conn, _):  # enable foreign keys in SQLite
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return eng


def _connect():
    try:
        eng = _make_engine(DATABASE_URL)
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        return eng, DATABASE_URL
    except Exception as exc:  # fall back to SQLite if MySQL is not reachable
        fallback = f"sqlite:///{(STORAGE_DIR / 'voc_analytics.db').as_posix()}"
        log.warning("Database %s not reachable (%s). Falling back to SQLite.", DATABASE_URL.split("@")[-1], exc)
        return _make_engine(fallback), fallback


engine, ACTIVE_DB_URL = _connect()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def db_label() -> str:
    if ACTIVE_DB_URL.startswith("sqlite"):
        return "SQLite (" + ACTIVE_DB_URL.split("///")[-1] + ")"
    return "MySQL (" + ACTIVE_DB_URL.split("@")[-1] + ")"
