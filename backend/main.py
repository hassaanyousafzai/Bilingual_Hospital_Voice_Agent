"""Bilingual Hospital Voice Agent — FastAPI backend entrypoint.

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000
or:
    python main.py
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import appointments, demo, feedback, live, voice
from app.config import settings
from app.database.seed import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hospital-voice-agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    provider = settings.active_llm_provider
    if provider == "gemini":
        logger.info("LLM: Gemini (%s) · TTS: %s", settings.gemini_chat_model, settings.active_tts_provider)
    elif provider == "groq":
        logger.info("LLM: Groq (%s) · TTS: %s", settings.groq_model, settings.active_tts_provider)
    else:
        logger.warning("No LLM key set — using the rule-based fallback agent.")
    yield


app = FastAPI(
    title="Bilingual Hospital Voice Agent API",
    version="1.0.0",
    description="Demo backend for a bilingual (English/Arabic) hospital voice agent.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router)
app.include_router(live.router)
app.include_router(appointments.router)
app.include_router(feedback.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_enabled": settings.llm_enabled}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
