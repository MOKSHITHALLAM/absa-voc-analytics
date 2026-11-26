"""FastAPI application entry point.

Run (from the backend folder):  uvicorn app.main:app --reload
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ml.config import FIGURES_DIR

from .config import CORS_ORIGINS
from .db import Base, SessionLocal, db_label, engine
from .routes import analysis, auth, insights
from .services import ensure_admin, record_training_run, seed_reviews

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("voc")
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        ensure_admin(db)
        record_training_run(db)
        seed_reviews(db)
    log.info("Database: %s", db_label())
    yield


app = FastAPI(title="ABSA & Voice of Customer Analytics API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(analysis.router)
app.include_router(insights.router)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/figures", StaticFiles(directory=FIGURES_DIR), name="figures")


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = FRONTEND_DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root():
        return {"message": "API is running. Open http://127.0.0.1:8000/docs, or start the frontend (npm run dev)."}
