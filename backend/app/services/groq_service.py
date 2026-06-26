"""Thin wrapper around the Groq API for LLM chat (with tool calling), structured
JSON output, and Whisper speech-to-text. Degrades gracefully when no key is set."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger("groq_service")

_client = None


class _RecoveredMessage:
    """Stand-in assistant message used when Groq rejects a malformed tool call but
    hands back the model's raw generation so we can parse it ourselves."""

    def __init__(self, content: str):
        self.content = content
        self.tool_calls = None


def _extract_failed_generation(exc: Exception) -> Optional[str]:
    """Pull the model's raw text out of a Groq `tool_use_failed` 400 error."""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        fg = body.get("error", {}).get("failed_generation")
        if fg:
            return fg
    m = re.search(r"failed_generation['\"]?\s*:\s*['\"](.+?)['\"]\s*\}\s*\}", str(exc), re.DOTALL)
    return m.group(1) if m else None


def _get_client():
    global _client
    if not settings.groq_enabled:
        return None
    if _client is None:
        try:
            from groq import Groq

            _client = Groq(api_key=settings.groq_api_key)
        except Exception as exc:  # pragma: no cover - import/setup guard
            logger.warning("Could not initialise Groq client: %s", exc)
            _client = None
    return _client


def llm_available() -> bool:
    return _get_client() is not None


def chat(
    messages: list[dict[str, Any]],
    tools: Optional[list[dict]] = None,
    temperature: float = 0.4,
    max_tokens: int = 900,
) -> Optional[Any]:
    """Return the raw assistant message object (may include tool_calls) or None."""
    client = _get_client()
    if client is None:
        return None
    try:
        kwargs: dict[str, Any] = {
            "model": settings.groq_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message
    except Exception as exc:
        # Some Llama models emit a malformed tool call that Groq rejects with a
        # 400 "tool_use_failed", returning the raw generation. Recover it so the
        # agent can parse the intended tool call instead of failing the turn.
        failed = _extract_failed_generation(exc)
        if failed:
            return _RecoveredMessage(failed)
        logger.warning("Groq chat failed: %s", exc)
        return None


def chat_text(messages: list[dict[str, Any]], temperature: float = 0.5) -> Optional[str]:
    msg = chat(messages, tools=None, temperature=temperature)
    if msg is None:
        return None
    return (msg.content or "").strip() or None


def chat_json(messages: list[dict[str, Any]], temperature: float = 0.2) -> Optional[dict]:
    """Request a JSON object response and parse it."""
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            temperature=temperature,
            max_tokens=900,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:
        logger.warning("Groq JSON chat failed: %s", exc)
        return None


def text_to_speech(text: str, language: str = "en") -> Optional[bytes]:
    """Generate natural neural speech with Groq Orpheus TTS (via REST so it works
    across SDK versions). Returns WAV bytes or None.

    NOTE: the Orpheus models require a one-time terms acceptance by the org admin at
    https://console.groq.com — until then this returns None and the client falls back
    to browser speech synthesis.
    """
    if not settings.groq_enabled or not text.strip():
        return None
    import httpx

    model = settings.groq_tts_model_ar if language == "ar" else settings.groq_tts_model_en
    voice = settings.groq_tts_voice_ar if language == "ar" else settings.groq_tts_voice_en
    try:
        resp = httpx.post(
            "https://api.groq.com/openai/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "voice": voice,
                "input": text[:1200],
                "response_format": "wav",
            },
            timeout=30.0,
        )
        if resp.status_code == 200:
            return resp.content
        logger.warning("Groq TTS HTTP %s: %s", resp.status_code, resp.text[:300])
        return None
    except Exception as exc:
        logger.warning("Groq TTS failed: %s", exc)
        return None


def transcribe(audio_bytes: bytes, filename: str = "audio.webm", language: Optional[str] = None) -> Optional[dict]:
    """Transcribe audio with Whisper on Groq. Returns {text, language} or None."""
    client = _get_client()
    if client is None:
        return None
    try:
        kwargs: dict[str, Any] = {
            "file": (filename, audio_bytes),
            "model": settings.groq_stt_model,
            "response_format": "verbose_json",
        }
        if language:
            kwargs["language"] = language
        result = client.audio.transcriptions.create(**kwargs)
        text = getattr(result, "text", "") or ""
        detected = getattr(result, "language", None)
        return {"text": text.strip(), "language": detected}
    except Exception as exc:
        logger.warning("Groq transcription failed: %s", exc)
        return None
