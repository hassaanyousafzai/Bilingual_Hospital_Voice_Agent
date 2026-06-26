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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agents.tools import TOOL_SCHEMAS, execute_tool
from app.config import settings
from app.database.db import SessionLocal
from app.prompts.prompts import live_system_prompt
from app.schemas.schemas import AgentState

logger = logging.getLogger("live")

router = APIRouter(prefix="/api/voice", tags=["voice-live"])

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"


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
                while True:
                    msg = await ws.receive_json()
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
                        break

            async def gemini_to_browser():
                # session.receive() yields for ONE turn then stops; loop for the next turn.
                while True:
                    async for resp in session.receive():
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

            await asyncio.gather(browser_to_gemini(), gemini_to_browser())

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
