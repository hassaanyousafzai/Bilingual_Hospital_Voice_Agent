from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents import booking_agent
from app.database.db import get_db
from app.schemas.schemas import (
    AgentState,
    Language,
    SessionMessage,
    SessionMessageOut,
    SessionStart,
    SessionStartOut,
    SimpleMessage,
    TranscribeOut,
)
from app.config import settings
from app.services import groq_service, tts as tts_service

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TTSIn(BaseModel):
    text: str
    language: Language = "en"


@router.post("/transcribe", response_model=TranscribeOut)
async def transcribe(
    audio: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    if not groq_service.llm_available():
        # No server-side STT — frontend should fall back to the browser Web Speech API.
        raise HTTPException(status_code=503, detail="stt_unavailable")
    data = await audio.read()
    result = groq_service.transcribe(data, filename=audio.filename or "audio.webm", language=language)
    if result is None:
        raise HTTPException(status_code=502, detail="transcription_failed")
    return TranscribeOut(text=result["text"], language=result.get("language"))


@router.get("/tts/status")
def tts_status():
    return tts_service.probe()


@router.post("/tts")
def tts(payload: TTSIn):
    """Neural text-to-speech (Gemini → Groq). Falls back to browser TTS on the client."""
    import logging
    import time

    t0 = time.perf_counter()
    audio = tts_service.synthesize(payload.text, payload.language)
    logging.getLogger("tts").info(
        "[timing] tts synth: %.2fs (%d chars)", time.perf_counter() - t0, len(payload.text)
    )
    if audio is None:
        raise HTTPException(status_code=503, detail="tts_unavailable")
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/session/start", response_model=SessionStartOut)
def session_start(payload: SessionStart):
    sid, greeting = booking_agent.start_session(payload.language)
    return SessionStartOut(session_id=sid, greeting=greeting, language=payload.language)


@router.post("/session/message", response_model=SessionMessageOut)
def session_message(payload: SessionMessage, db: Session = Depends(get_db)):
    session = booking_agent.get_session(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    reply, tools_used = booking_agent.run_turn(db, session, payload.message, payload.language)
    state = AgentState.model_validate(session.state)
    status = "emergency" if state.emergency else "speaking"
    return SessionMessageOut(
        session_id=session.id,
        reply=reply,
        language=session.language,
        status=status,
        state=state,
        tools_used=tools_used,
    )


@router.post("/session/end", response_model=SimpleMessage)
def session_end(payload: SessionMessage):
    booking_agent.end_session(payload.session_id)
    return SimpleMessage(message="Session ended.")
