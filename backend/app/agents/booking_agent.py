"""Booking voice agent: an LLM tool-calling loop with a deterministic rule-based
fallback so the demo works even without a Groq API key."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.agents.tools import TOOL_SCHEMAS, execute_tool
from app.prompts.prompts import booking_system_prompt
from app.services import llm_service, specialty
from app.utils.datetime_utils import extract_date, extract_time

logger = logging.getLogger("booking_agent")

MAX_TOOL_ITERATIONS = 6

# Some Llama models occasionally emit tool calls as plain TEXT instead of using the
# native tool-calling interface, e.g. `<function=get_doctors_by_specialty>{...}</function>`.
# These patterns let us recover and execute them so the conversation never breaks.
# Handles the several malformed shapes Llama/Groq produce, e.g.:
#   <function=name>{...}</function>
#   <function=name({...})</function>
#   <function=name,{...}</function>
#   <function=name{...}>
_INLINE_TOOL_PATTERNS = [
    re.compile(r"<function\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[(,>]?\s*(\{.*?\})\s*\)?\s*</function>", re.DOTALL),
    re.compile(r"<function\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[(,>]?\s*(\{.*?\})\s*\)?\s*/?>", re.DOTALL),
    re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL),
]


def _parse_inline_tool_calls(content: str) -> list[tuple[str, dict]]:
    calls: list[tuple[str, dict]] = []
    if not content:
        return calls
    for pat in _INLINE_TOOL_PATTERNS[:2]:
        for m in pat.finditer(content):
            try:
                args = json.loads(m.group(2))
            except (json.JSONDecodeError, IndexError):
                args = {}
            calls.append((m.group(1), args))
    # {"name": ..., "arguments": ...} style inside <tool_call>
    for m in _INLINE_TOOL_PATTERNS[2].finditer(content):
        try:
            obj = json.loads(m.group(1))
            name = obj.get("name")
            args = obj.get("arguments") or obj.get("parameters") or {}
            if isinstance(args, str):
                args = json.loads(args)
            if name:
                calls.append((name, args))
        except (json.JSONDecodeError, AttributeError):
            continue
    return calls


def _strip_tool_syntax(text: str) -> str:
    if not text:
        return ""
    for pat in _INLINE_TOOL_PATTERNS:
        text = pat.sub("", text)
    text = re.sub(r"</?function[^>]*>", "", text)
    text = re.sub(r"</?tool_call>", "", text)
    return text.strip()


@dataclass
class BookingSession:
    id: str
    language: str = "en"
    history: list[dict[str, Any]] = field(default_factory=list)
    state: dict[str, Any] = field(default_factory=dict)

    def fresh_state(self) -> dict[str, Any]:
        return {
            "phase": "intake",
            "emergency": False,
            "department": None,
            "doctors": [],
            "slots": [],
            "selected_doctor_id": None,
            "requested_slot": None,
            "nearest_slot": None,
            "appointment": None,
            "language": self.language,
        }


_SESSIONS: dict[str, BookingSession] = {}


GREETINGS = {
    "en": "Hello, I am your hospital appointment assistant. Please tell me what symptoms or concerns you are experiencing.",
    "ar": "مرحباً، أنا مساعد حجز المواعيد. أخبرني عن الأعراض أو المشكلة التي تشعر بها وسأساعدك في إيجاد الطبيب المناسب.",
}


def start_session(language: str = "en") -> tuple[str, str]:
    sid = uuid.uuid4().hex[:12]
    session = BookingSession(id=sid, language=language)
    session.state = session.fresh_state()
    _SESSIONS[sid] = session
    return sid, GREETINGS.get(language, GREETINGS["en"])


def get_session(session_id: str) -> BookingSession | None:
    return _SESSIONS.get(session_id)


def end_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)


def _serialize_assistant(msg) -> dict[str, Any]:
    out: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
    if getattr(msg, "tool_calls", None):
        out["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            }
            for tc in msg.tool_calls
        ]
    return out


def run_turn(db: Session, session: BookingSession, user_message: str, language: str | None) -> tuple[str, list[str]]:
    # Lock in/refresh the conversation language.
    detected = specialty.detect_language(user_message)
    session.language = language or detected or session.language
    session.state["language"] = session.language

    t0 = time.perf_counter()
    if llm_service.llm_available():
        reply, tools = _run_llm_turn(db, session, user_message)
    else:
        reply, tools = _run_fallback_turn(db, session, user_message)
    logger.info(
        "[timing] booking turn (%s): %.2fs | tools=%s",
        llm_service.active_provider(),
        time.perf_counter() - t0,
        tools or "-",
    )
    return reply, tools


# ── LLM path ─────────────────────────────────────────────────────────────────
def _state_context(state: dict[str, Any]) -> str:
    """Snapshot of the current booking so the model always has the right IDs."""
    lines: list[str] = []
    dept = state.get("department")
    if dept:
        lines.append(f"Recommended department: {dept['key']} ({dept['name_en']})")
    docs = state.get("doctors") or []
    if docs:
        lines.append("Doctors shown: " + ", ".join(f"[id {d['id']}] {d['name_en']}" for d in docs))
    sid = state.get("selected_doctor_id")
    if sid:
        sel = next((d for d in docs if d["id"] == sid), None)
        lines.append(f"Selected doctor: id {sid}" + (f" ({sel['name_en']})" if sel else ""))
    ns = state.get("nearest_slot")
    if ns:
        lines.append(f"Nearest available slot: {ns['date']} at {ns['time']}")
    appt = state.get("appointment")
    if appt:
        lines.append(
            f"Confirmed appointment: {appt['reference']} with {appt['doctor_name_en']} on {appt['date']} at {appt['time']}"
        )
    if not lines:
        return ""
    return (
        "CURRENT BOOKING CONTEXT (authoritative — always pass these exact IDs to tools):\n- "
        + "\n- ".join(lines)
    )


def _run_llm_turn(db: Session, session: BookingSession, user_message: str) -> tuple[str, list[str]]:
    tools_used: list[str] = []
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": booking_system_prompt(session.language)},
    ]
    context = _state_context(session.state)
    if context:
        messages.append({"role": "system", "content": context})
    messages += [*session.history, {"role": "user", "content": user_message}]

    final_text: str | None = None
    for i in range(MAX_TOOL_ITERATIONS):
        msg = llm_service.chat(messages, tools=TOOL_SCHEMAS, temperature=0.25, max_tokens=700)
        if msg is None:  # transient failure -> fall back gracefully
            return _run_fallback_turn(db, session, user_message)

        if getattr(msg, "tool_calls", None):
            messages.append(_serialize_assistant(msg))
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = execute_tool(tc.function.name, args, db, session.state)
                tools_used.append(tc.function.name)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.function.name,  # needed by the Gemini function-response format
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            continue

        content = msg.content or ""

        # Recover tool calls the model wrote as plain text instead of using the API.
        inline = _parse_inline_tool_calls(content)
        if inline:
            for name, args in inline:
                result = execute_tool(name, args, db, session.state)
                tools_used.append(name)
                messages.append(
                    {
                        "role": "system",
                        "content": (
                            f"Result of {name}({json.dumps(args, ensure_ascii=False)}): "
                            f"{json.dumps(result, ensure_ascii=False)}. "
                            "Now reply to the patient in their language using this result. "
                            "Do NOT output any function or tool-call syntax."
                        ),
                    }
                )
            continue

        final_text = _strip_tool_syntax(content)
        if final_text:
            break

    if not final_text:
        final_text = _fallback_text(session.language, "default")

    # Persist conversation (skip the system prompt; keep user + assistant turns).
    session.history.append({"role": "user", "content": user_message})
    session.history.append({"role": "assistant", "content": final_text})
    session.history = session.history[-20:]
    return final_text, tools_used


# ── Rule-based fallback path (no API key) ────────────────────────────────────
_YES = {"en": ["yes", "yeah", "yep", "sure", "ok", "okay", "please", "go ahead", "confirm",
               "book", "that works", "sounds good", "perfect", "alright", "do it"],
        "ar": ["نعم", "اجل", "أجل", "تمام", "موافق", "حسنا", "حسناً", "احجز", "أكد", "اوكي", "ماشي", "اكيد"]}
_NO = {"en": ["no", "not now", "later", "nope", "don't", "do not"],
       "ar": ["لا", "ليس", "ليست", "مش", "كلا"]}


def _is_yes(text: str, lang: str) -> bool:
    low = text.lower()
    return any(w in low for w in _YES["en"] + _YES["ar"])


def _is_no(text: str, lang: str) -> bool:
    low = text.lower()
    return any(w in low for w in _NO["en"] + _NO["ar"])


def _doctor_name(d: dict, lang: str) -> str:
    return d["name_ar"] if lang == "ar" else d["name_en"]


def _dept_name(d: dict | None, lang: str) -> str:
    if not d:
        return ""
    return d["name_ar"] if lang == "ar" else d["name_en"]


def _say_time(t: str) -> str:
    return t


def _run_fallback_turn(db: Session, session: BookingSession, user_message: str) -> tuple[str, list[str]]:
    lang = session.language
    state = session.state
    phase = state.get("phase", "intake")
    tools: list[str] = []
    text = user_message.strip()

    # Emergency screening always wins.
    if specialty.is_emergency(text):
        execute_tool("recommend_specialty", {"symptoms": text}, db, state)
        tools.append("recommend_specialty")
        return _fallback_text(lang, "emergency"), tools

    if phase in ("intake", "recommend") and not _is_yes(text, lang) and not _is_no(text, lang) and len(text) > 2 and not state.get("doctors"):
        # Treat as symptom description → recommend specialty.
        res = execute_tool("recommend_specialty", {"symptoms": text}, db, state)
        tools.append("recommend_specialty")
        dept = state.get("department")
        name = _dept_name(dept, lang)
        return _fallback_text(lang, "recommend", dept=name), tools

    if phase == "recommend" or (phase == "intake" and (_is_yes(text, lang) or _is_no(text, lang))):
        if _is_no(text, lang):
            return _fallback_text(lang, "ask_symptoms"), tools
        dept = state.get("department")
        if not dept:
            return _fallback_text(lang, "ask_symptoms"), tools
        execute_tool("get_doctors_by_specialty", {"specialty_key": dept["key"]}, db, state)
        tools.append("get_doctors_by_specialty")
        doctors = state.get("doctors", [])
        if not doctors:
            return _fallback_text(lang, "no_doctors"), tools
        top = doctors[0]
        na = top.get("next_available")
        when = f"{na['date']} {na['time']}" if na else ""
        return _fallback_text(lang, "doctors", name=_doctor_name(top, lang), count=len(doctors), when=when), tools

    if phase == "doctors":
        doctors = state.get("doctors", [])
        chosen = _match_doctor(text, doctors, lang)
        if not chosen and doctors:
            chosen = doctors[0]
        if not chosen:
            return _fallback_text(lang, "ask_symptoms"), tools
        execute_tool("get_available_slots", {"doctor_id": chosen["id"]}, db, state)
        tools.append("get_available_slots")
        slots = state.get("slots", [])
        first = slots[0] if slots else None
        when = f"{first['date']} {first['time']}" if first else ""
        return _fallback_text(lang, "slots", name=_doctor_name(chosen, lang), when=when), tools

    if phase == "slots":
        doctor_id = state.get("selected_doctor_id")
        req_date = extract_date(text)
        req_time = extract_time(text)
        if doctor_id and (req_time or req_date):
            date = req_date or (state["slots"][0]["date"] if state.get("slots") else "")
            time = req_time or (state["slots"][0]["time"] if state.get("slots") else "")
            result = execute_tool(
                "find_nearest_available_slot",
                {"doctor_id": doctor_id, "date": date, "time": time}, db, state,
            )
            tools.append("find_nearest_available_slot")
            if result.get("requested_available"):
                slot = result["requested"]
                return _fallback_text(lang, "offer_confirm", when=f"{slot['date']} {slot['time']}"), tools
            nearest = result.get("nearest")
            if nearest:
                return _fallback_text(lang, "offer_nearest", when=f"{nearest['date']} {nearest['time']}"), tools
            return _fallback_text(lang, "no_slots"), tools
        if _is_yes(text, lang) and state.get("nearest_slot"):
            return _confirm_pending(db, session, tools)
        return _fallback_text(lang, "ask_time"), tools

    if phase in ("confirm", "slots") and _is_yes(text, lang) and state.get("nearest_slot"):
        return _confirm_pending(db, session, tools)

    if phase == "confirmed":
        return _fallback_text(lang, "post_confirm"), tools

    return _fallback_text(lang, "default"), tools


def _confirm_pending(db: Session, session: BookingSession, tools: list[str]) -> tuple[str, list[str]]:
    state = session.state
    lang = session.language
    slot = state.get("nearest_slot") or state.get("requested_slot")
    doctor_id = state.get("selected_doctor_id")
    if not (slot and doctor_id):
        return _fallback_text(lang, "ask_time"), tools
    result = execute_tool(
        "confirm_appointment",
        {"doctor_id": doctor_id, "date": slot["date"], "time": slot["time"]}, db, state,
    )
    tools.append("confirm_appointment")
    if result.get("confirmed"):
        appt = result["appointment"]
        name = appt["doctor_name_ar"] if lang == "ar" else appt["doctor_name_en"]
        return _fallback_text(
            lang, "confirmed", name=name, when=f"{appt['date']} {appt['time']}", ref=appt["reference"]
        ), tools
    nearest = result.get("nearest")
    if nearest:
        return _fallback_text(lang, "offer_nearest", when=f"{nearest['date']} {nearest['time']}"), tools
    return _fallback_text(lang, "no_slots"), tools


def _match_doctor(text: str, doctors: list[dict], lang: str) -> dict | None:
    low = text.lower()
    for d in doctors:
        if d["name_en"].lower() in low or d["name_ar"] in text:
            return d
        last_en = d["name_en"].replace("Dr. ", "").split()[0].lower()
        if last_en in low:
            return d
    ordinals = {"first": 0, "1": 0, "one": 0, "second": 1, "2": 1, "two": 1,
                "third": 2, "3": 2, "three": 2, "الأول": 0, "الثاني": 1, "الثالث": 2}
    for word, idx in ordinals.items():
        if word in low and idx < len(doctors):
            return doctors[idx]
    return None


def _fallback_text(lang: str, kind: str, **kw) -> str:
    en = {
        "emergency": "Your symptoms may require urgent medical attention. Please contact local emergency services or visit the nearest emergency department immediately.",
        "recommend": f"Based on the symptoms you shared, a {kw.get('dept','General Medicine')} consultation may be appropriate. Please note this is a recommendation, not a diagnosis. Would you like me to find an available doctor?",
        "ask_symptoms": "No problem. Whenever you are ready, tell me what symptoms or concerns you are experiencing.",
        "doctors": f"I found {kw.get('count',3)} available doctors. {kw.get('name','The first doctor')} has the earliest availability, on {kw.get('when','')}. Which doctor would you like to see?",
        "no_doctors": "I'm sorry, I could not find an available doctor right now. Would you like to try another department?",
        "slots": f"{kw.get('name','The doctor')} is available, with the earliest opening on {kw.get('when','')}. What day and time would work best for you?",
        "offer_confirm": f"Good news — that time, {kw.get('when','')}, is available. Would you like me to confirm this appointment?",
        "offer_nearest": f"That exact time is not available. The nearest available time is {kw.get('when','')}. Would you like me to book that slot?",
        "ask_time": "What day and time would you prefer for the appointment?",
        "no_slots": "I'm sorry, there are no available slots for that doctor right now. Would you like to try another doctor?",
        "confirmed": f"Your appointment with {kw.get('name','the doctor')} has been confirmed for {kw.get('when','')}. Your appointment reference is {kw.get('ref','')}. Is there anything else I can help you with?",
        "post_confirm": "Your appointment is confirmed. You can say 'book another appointment' to start again, or end the session.",
        "default": "I'm here to help you book an appointment. Could you tell me a little more about your symptoms?",
    }
    ar = {
        "emergency": "قد تتطلب الأعراض التي ذكرتها رعاية طبية عاجلة. يرجى الاتصال بخدمات الطوارئ المحلية أو التوجه إلى أقرب قسم طوارئ على الفور.",
        "recommend": f"بناءً على الأعراض التي ذكرتها، قد يكون من المناسب استشارة قسم {kw.get('dept','الطب العام')}. يرجى ملاحظة أن هذه توصية وليست تشخيصاً. هل تود أن أبحث لك عن طبيب متاح؟",
        "ask_symptoms": "لا مشكلة. عندما تكون مستعداً، أخبرني بالأعراض أو المشكلة التي تشعر بها.",
        "doctors": f"وجدت {kw.get('count',3)} أطباء متاحين. {kw.get('name','الطبيب الأول')} لديه أقرب موعد متاح في {kw.get('when','')}. أي طبيب تود أن تراه؟",
        "no_doctors": "عذراً، لم أتمكن من إيجاد طبيب متاح الآن. هل تود تجربة قسم آخر؟",
        "slots": f"{kw.get('name','الطبيب')} متاح، وأقرب موعد في {kw.get('when','')}. ما اليوم والوقت المناسب لك؟",
        "offer_confirm": f"خبر جيد — هذا الموعد، {kw.get('when','')}، متاح. هل تود أن أؤكد الحجز؟",
        "offer_nearest": f"هذا الوقت بالتحديد غير متاح. أقرب موعد متاح هو {kw.get('when','')}. هل تود حجز هذا الموعد؟",
        "ask_time": "ما اليوم والوقت الذي تفضله للموعد؟",
        "no_slots": "عذراً، لا توجد مواعيد متاحة لهذا الطبيب حالياً. هل تود تجربة طبيب آخر؟",
        "confirmed": f"تم تأكيد موعدك مع {kw.get('name','الطبيب')} في {kw.get('when','')}. رقم مرجع الحجز هو {kw.get('ref','')}. هل هناك أي شيء آخر يمكنني مساعدتك به؟",
        "post_confirm": "تم تأكيد موعدك. يمكنك قول «احجز موعداً آخر» للبدء من جديد، أو إنهاء الجلسة.",
        "default": "أنا هنا لمساعدتك في حجز موعد. هل يمكنك إخباري المزيد عن الأعراض التي تشعر بها؟",
    }
    table = ar if lang == "ar" else en
    return table.get(kind, table["default"])
