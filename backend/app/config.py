"""Application settings (environment variables or backend/.env)."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

STORAGE_DIR = BACKEND_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(STORAGE_DIR / 'voc_analytics.db').as_posix()}")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please-32-chars-min")
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "720"))
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@vocanalytics.app")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
SEED_LIMIT = int(os.getenv("SEED_LIMIT", "1500"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
MAX_TEXT_CHARS = 2000
MAX_UPLOAD_MB = 15
