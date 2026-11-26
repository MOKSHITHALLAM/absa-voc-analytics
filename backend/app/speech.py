"""Optional voice input: speech-to-text with faster-whisper (offline, CPU).

Install with:  pip install faster-whisper
The first transcription downloads the Whisper model (~140 MB for "base").
"""
from __future__ import annotations

import logging
import tempfile
from functools import lru_cache
from pathlib import Path

from .config import WHISPER_MODEL

log = logging.getLogger("voc.speech")

AUDIO_MAGIC = (b"RIFF", b"\x1aE\xdf\xa3", b"OggS", b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"fLaC")


class SpeechUnavailable(RuntimeError):
    pass


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def looks_like_audio(data: bytes) -> bool:
    head = data[:12]
    return head.startswith(AUDIO_MAGIC) or head[4:8] == b"ftyp"


@lru_cache(maxsize=1)
def _model():
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SpeechUnavailable("Voice input needs faster-whisper. Run: pip install faster-whisper") from exc
    log.info("Loading Whisper model '%s' (first use downloads it)", WHISPER_MODEL)
    return WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")


def transcribe(data: bytes, suffix: str = ".webm") -> dict:
    """Transcribe audio bytes. Non-English speech is translated to English,
    because the classifiers were trained on English reviews."""
    model = _model()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = Path(tmp.name)
    try:
        segments, info = model.transcribe(str(path), task="translate", vad_filter=True, beam_size=1)
        text = " ".join(s.text.strip() for s in segments).strip()
    finally:
        path.unlink(missing_ok=True)
    return {"text": text, "language": info.language, "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 1)}
