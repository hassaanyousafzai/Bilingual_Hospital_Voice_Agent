"""Neural text-to-speech with provider fallback.

Order (auto): Gemini (AI Studio, natural female voices) → Groq Orpheus → None.
If this returns None, the frontend falls back to the browser's built-in voice.
"""

from __future__ import annotations

import base64
import logging
import re
import struct

import httpx

from app.config import settings

logger = logging.getLogger("tts")


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    data_size = len(pcm)
    header = b"RIFF" + struct.pack("<I", 36 + data_size) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, sample_rate, byte_rate, block_align, bits)
    header += b"data" + struct.pack("<I", data_size)
    return header + pcm


def _gemini_tts(text: str) -> bytes | None:
    key = settings.gemini_api_key.strip()
    if not key:
        return None
    model = settings.gemini_tts_model
    voice = settings.gemini_tts_voice
    # A natural-language style prompt makes the delivery warm and human (Gemini reads
    # only the content; the instruction shapes the tone).
    styled = (
        "Say the following in a warm, friendly, natural and caring human tone, "
        f"like a real hospital receptionist: {text}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": styled}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    try:
        r = httpx.post(url, json=body, timeout=45.0)
        if r.status_code != 200:
            logger.warning("Gemini TTS HTTP %s: %s", r.status_code, r.text[:300])
            return None
        data = r.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        for p in parts:
            inline = p.get("inlineData") or p.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or ""
                pcm = base64.b64decode(inline["data"])
                rate = 24000
                m = re.search(r"rate=(\d+)", mime)
                if m:
                    rate = int(m.group(1))
                # Some responses are already WAV; pass through if so.
                if pcm[:4] == b"RIFF":
                    return pcm
                return _pcm_to_wav(pcm, sample_rate=rate)
        logger.warning("Gemini TTS returned no audio part")
        return None
    except Exception as exc:
        logger.warning("Gemini TTS failed: %s", exc)
        return None


def synthesize(text: str, language: str = "en") -> bytes | None:
    # Gemini only — no robotic Groq fallback.
    if not text.strip():
        return None
    return _gemini_tts(text)


_probe_cache: dict[str, dict] = {}


def probe() -> dict:
    """Honest report of whether the neural voice is available (Gemini only)."""
    if not settings.gemini_api_key.strip():
        return {"provider": "browser", "ready": False, "voice": ""}
    if "gemini" in _probe_cache:
        return _probe_cache["gemini"]
    audio = _gemini_tts("Hello.")
    result = (
        {"provider": "gemini", "ready": True, "voice": settings.gemini_tts_voice}
        if audio
        else {"provider": "browser", "ready": False, "voice": ""}
    )
    _probe_cache["gemini"] = result
    return result
