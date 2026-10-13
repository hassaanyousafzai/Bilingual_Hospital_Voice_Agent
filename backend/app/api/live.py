"""Realtime voice via the Gemini Live API (native audio, streaming, server-side VAD).

The browser opens a WebSocket here; we bridge it to a Gemini Live session so audio
streams both ways with sub-second turn-taking and natural, human speech. Booking tools
run server-side and UI state is pushed back to the browser. The Gemini key never leaves
the server.
"""

from __future__ import annotations

import asyncio
import base64
import logging

import time
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agents.tools import TOOL_SCHEMAS, execute_tool
from app.config import settings
from app.database.db import SessionLocal
from app.prompts.prompts import live_system_prompt
from app.schemas.schemas import AgentState

logger = logging.getLogger("live")

router = APIRouter(prefix="/api/voice", tags=["voice-live"])

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"

# Safety limits to prevent free API quota exhaustion
MAX_CALL_DURATION_SECONDS = 180  # 3 minutes maximum per call
MAX_IDLE_SECONDS = 60            # 60 seconds of complete silence/inactivity
RATE_LIMIT_CALLS_PER_HOUR = 8    # Max 8 calls per IP per hour
RATE_LIMIT_WINDOW = 3600         # 1 hour window

# In-memory IP tracking: ip -> list of call start timestamps
_ip_call_history: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> bool:
    """Returns True if the client IP has exceeded the hourly call quota."""
    now = time.time()
    # Prune calls older than 1 hour
    history = [t for t in _ip_call_history[client_ip] if now - t < RATE_LIMIT_WINDOW]
    _ip_call_history[client_ip] = history
    if len(history) >= RATE_LIMIT_CALLS_PER_HOUR:
        return False
    _ip_call_history[client_ip].append(now)
    return True


def _function_declarations() -> list[dict]:
    return [
        {
            "name": t["function"]["name"],
            "description": t["function"].get("description", ""),
            "parameters": t["function"].get("parameters", {"type": "object", "properties": {}}),
        }
        for t in TOOL_SCHEMAS
    ]


def _fresh_state(language: str) -> dict:
    return {
        "phase": "intake", "emergency": False, "department": None, "doctors": [],
        "slots": [], "selected_doctor_id": None, "requested_slot": None,
        "nearest_slot": None, "appointment": None, "language": language,
    }


def _ui_state(state: dict) -> dict:
    return AgentState.model_validate(state).model_dump()


@router.websocket("/live")
async def live(ws: WebSocket):
    await ws.accept()
    language = ws.query_params.get("lang", "en")

    # Extract client IP (handle proxies like Vercel / Cloudflare)
    client_ip = (
        ws.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or ws.client.host
        if ws.client
        else "unknown"
    )

    if not _check_rate_limit(client_ip):
        msg = (
            "تم تجاوز الحد المسموح به للمكالمات التجريبية لهذه الساعة. الرجاء المحاولة لاحقاً."
            if language == "ar"
            else "Hourly demo call limit reached (8 calls/hour). Please try again later."
        )
        await ws.send_json({"type": "error", "message": msg})
        await ws.close()
        return

    if not settings.gemini_api_key:
        await ws.send_json({"type": "error", "message": "gemini_key_missing"})
        await ws.close()
        return

    from google import genai
    from google.genai import types

    state = _fresh_state(language)
    db = SessionLocal()
    client = genai.Client(api_key=settings.gemini_api_key)

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(parts=[types.Part(text=live_system_prompt(language))]),
        tools=[types.Tool(function_declarations=_function_declarations())],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=settings.gemini_tts_voice)
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    last_active = time.time()
    call_start = time.time()
    stop_event = asyncio.Event()

    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
            await ws.send_json({"type": "ready"})

            # Make the agent open the call with a warm greeting (this nudge text is not
            # spoken back and is not transcribed).
            greet = (
                "ابدأ المكالمة الآن. رحّب بالمريض وعرّف بنفسك في جملة أو جملتين قصيرتين: "
                "قل «مرحباً، أنا شفاء، مساعدتك في حجز المواعيد بالمستشفى»، ثم اسأله بلطف عن "
                "الأعراض أو المشكلة التي يشعر بها اليوم."
                if language == "ar"
                else "Start the call now. Warmly greet and introduce yourself in one or two short "
                "sentences: say something like 'Hi, my name is Shifa, your appointment assistant "
                "here at the hospital', then kindly ask what symptoms or concerns bring them in today."
            )
            await session.send_client_content(
                turns=types.Content(role="user", parts=[types.Part(text=greet)]),
                turn_complete=True,
            )

            async def browser_to_gemini():
                nonlocal last_active
                while not stop_event.is_set():
                    msg = await ws.receive_json()
                    last_active = time.time()
                    kind = msg.get("type")
                    if kind == "audio":
                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=base64.b64decode(msg["data"]),
                                mime_type="audio/pcm;rate=16000",
                            )
                        )
                    elif kind == "text":
                        await session.send_client_content(
                            turns=types.Content(role="user", parts=[types.Part(text=msg.get("text", ""))]),
                            turn_complete=True,
                        )
                    elif kind == "end":
                        stop_event.set()
                        break

            async def gemini_to_browser():
                # session.receive() yields for ONE turn then stops; loop for the next turn.
                while not stop_event.is_set():
                    async for resp in session.receive():
                        if stop_event.is_set():
                            break
                        if resp.data:
                            await ws.send_json(
                                {"type": "audio", "data": base64.b64encode(resp.data).decode("ascii")}
                            )

                        sc = resp.server_content
                        if sc:
                            if sc.interrupted:
                                await ws.send_json({"type": "interrupted"})
                            if sc.input_transcription and sc.input_transcription.text:
                                await ws.send_json(
                                    {"type": "transcript", "role": "user", "text": sc.input_transcription.text}
                                )
                            if sc.output_transcription and sc.output_transcription.text:
                                await ws.send_json(
                                    {"type": "transcript", "role": "agent", "text": sc.output_transcription.text}
                                )
                            if sc.turn_complete:
                                await ws.send_json({"type": "turn_complete"})

                        if resp.tool_call:
                            responses = []
                            for fc in resp.tool_call.function_calls:
                                args = dict(fc.args) if fc.args else {}
                                result = execute_tool(fc.name, args, db, state)
                                responses.append(
                                    types.FunctionResponse(id=fc.id, name=fc.name, response=result)
                                )
                                await ws.send_json({"type": "state", "state": _ui_state(state)})
                            await session.send_tool_response(function_responses=responses)

            async def quota_watchdog():
                """Closes long-running or abandoned calls to preserve free Gemini API quotas."""
                while not stop_event.is_set():
                    await asyncio.sleep(5)
                    now = time.time()
                    # 1. Total duration cap
                    if now - call_start > MAX_CALL_DURATION_SECONDS:
                        limit_msg = (
                            "تم الوصول إلى الحد الأقصى للمكالمة التجريبية (3 دقائق). شكراً لتجربتك لشفاء!"
                            if language == "ar"
                            else "Demo call time limit reached (3 minutes). Thank you for trying Shifa!"
                        )
                        logger.info("Call closed: max duration reached (%ds) for %s", MAX_CALL_DURATION_SECONDS, client_ip)
                        await ws.send_json({"type": "error", "message": limit_msg})
                        stop_event.set()
                        break
                    # 2. Idle / silence timeout
                    if now - last_active > MAX_IDLE_SECONDS:
                        idle_msg = (
                            "تم إنهاء المكالمة لعدم النشاط لتوفير الموارد."
                            if language == "ar"
                            else "Call ended due to 60 seconds of inactivity to save quota."
                        )
                        logger.info("Call closed: inactivity timeout (%ds) for %s", MAX_IDLE_SECONDS, client_ip)
                        await ws.send_json({"type": "error", "message": idle_msg})
                        stop_event.set()
                        break

            await asyncio.gather(
                browser_to_gemini(),
                gemini_to_browser(),
                quota_watchdog(),
                return_exceptions=True,
            )

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # surface a clean error to the client
        logger.warning("Live session error: %s", exc)
        try:
            await ws.send_json({"type": "error", "message": str(exc)[:200]})
        except Exception:
            pass
    finally:
        db.close()
        try:
            await ws.close()
        except Exception:
            pass
