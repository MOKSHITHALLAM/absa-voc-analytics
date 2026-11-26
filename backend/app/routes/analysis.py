"""Analysis endpoints: single text, batch CSV, voice."""
from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ml.predictor import ModelNotTrained, get_predictor

from .. import speech
from ..config import MAX_TEXT_CHARS, MAX_UPLOAD_MB
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import review_to_dict, store_analysis

router = APIRouter(prefix="/api", tags=["analysis"])


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=3, max_length=MAX_TEXT_CHARS)
    clause_mode: bool = False
    save: bool = True
    hotel: str | None = Field(default=None, max_length=160)


def predictor():
    try:
        return get_predictor()
    except ModelNotTrained as exc:
        raise HTTPException(503, str(exc))


@router.post("/analyze")
def analyze(body: AnalyzeIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    text = body.text.strip()
    if len(text.split()) < 2:
        raise HTTPException(422, "Enter at least two words of review text.")
    result = predictor().analyze(text, clause_mode=body.clause_mode)
    if body.save:
        r = store_analysis(db, result, "manual", user, body.hotel, body.clause_mode)
        result["review_id"] = r.id
    return result


TEXT_COLUMNS = ("text", "review", "sentence", "comment", "feedback", "content")


@router.post("/analyze/batch")
async def analyze_batch(file: UploadFile = File(...), clause_mode: bool = Form(False),
                        db: Session = Depends(get_db), user: User = Depends(current_user)):
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {MAX_UPLOAD_MB} MB.")
    name = (file.filename or "").lower()
    try:
        if name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(data))
        elif name.endswith(".txt"):
            df = pd.DataFrame({"text": data.decode("utf-8", "replace").splitlines()})
        else:
            df = pd.read_csv(io.BytesIO(data), sep=None, engine="python", encoding_errors="replace")
    except Exception:
        raise HTTPException(422, "Could not read the file. Upload a CSV, XLSX or TXT file.")
    cols = {c.lower().strip(): c for c in df.columns}
    tcol = next((cols[c] for c in TEXT_COLUMNS if c in cols), None)
    if tcol is None:
        obj = [c for c in df.columns if df[c].dtype == object]
        if not obj:
            raise HTTPException(422, "No text column found. Name the column 'text' or 'review'.")
        tcol = max(obj, key=lambda c: df[c].astype(str).str.len().mean())
    hcol = next((cols[c] for c in ("hotel", "property", "hotel_name") if c in cols), None)
    rows = df[[tcol] + ([hcol] if hcol else [])].dropna(subset=[tcol])
    rows = rows[rows[tcol].astype(str).str.split().str.len() >= 2].head(2000)
    if rows.empty:
        raise HTTPException(422, "The file has no review text with at least two words.")
    p = predictor()
    out = []
    for row in rows.itertuples(index=False):
        text = str(row[0])[:MAX_TEXT_CHARS]
        res = p.analyze(text, clause_mode=clause_mode)
        r = store_analysis(db, res, "batch", user, str(row[1]) if hcol else None, clause_mode, commit=False)
        out.append(r)
    db.commit()
    items = [review_to_dict(r) for r in out]
    counts = pd.Series([i["sentiment"] for i in items]).value_counts().to_dict()
    return {"processed": len(items), "text_column": tcol, "sentiment_counts": counts, "items": items[:200]}


@router.post("/voice")
async def voice(audio: UploadFile = File(...), clause_mode: bool = Form(False), save: bool = Form(True),
                hotel: str | None = Form(None), db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not speech.available():
        raise HTTPException(503, "Voice input is not installed on the server. Run: pip install faster-whisper")
    data = await audio.read()
    if not data or len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Audio must be between 1 byte and {MAX_UPLOAD_MB} MB.")
    if not speech.looks_like_audio(data):
        raise HTTPException(415, "That file is not a supported audio format (wav, webm, ogg, mp3, m4a, flac).")
    suffix = "." + (audio.filename or "rec.webm").rsplit(".", 1)[-1][:5]
    try:
        tr = speech.transcribe(data, suffix)
    except speech.SpeechUnavailable as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:  # decoding problems
        raise HTTPException(422, f"Could not transcribe the audio: {exc}")
    if len(tr["text"].split()) < 2:
        raise HTTPException(422, "No speech was recognised. Speak clearly for a few seconds and try again.")
    result = predictor().analyze(tr["text"], clause_mode=clause_mode)
    result["transcription"] = tr
    if save:
        r = store_analysis(db, result, "voice", user, hotel, clause_mode)
        result["review_id"] = r.id
    return result
