"""Tool schemas exposed to the booking agent and the dispatcher that executes
them against the database. Every booking fact comes from here, never the LLM."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Department
from app.services import booking_service, specialty
from app.utils.datetime_utils import normalize_date, normalize_time

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "recommend_specialty",
            "description": "Analyse the patient's described symptoms and recommend the most "
            "appropriate medical department. Also screens for emergency symptoms. "
            "Call this once you understand the patient's main symptoms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symptoms": {
                        "type": "string",
                        "description": "The patient's described symptoms or concerns.",
                    }
                },
                "required": ["symptoms"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_departments",
            "description": "List all hospital departments the patient can be booked into.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_doctors_by_specialty",
            "description": "Get available doctors for a department. Returns doctor names, "
            "experience, languages and next available appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "specialty_key": {
                        "type": "string",
                        "enum": ["cardiology", "pulmonology", "endocrinology", "dermatology", "general"],
                        "description": "The department key to search doctors in.",
                    }
                },
                "required": ["specialty_key"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_available_slots",
            "description": "Get available appointment time slots for a specific doctor, "
            "optionally filtered to a date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "integer"},
                    "date": {"type": "string", "description": "Optional date, e.g. 'tomorrow' or 'YYYY-MM-DD'."},
                },
                "required": ["doctor_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_nearest_available_slot",
            "description": "Check whether a doctor is free at a requested date and time. "
            "Returns whether the requested slot is available and the nearest alternative.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "integer"},
                    "date": {"type": "string", "description": "Requested date, e.g. 'tomorrow' or 'YYYY-MM-DD'."},
                    "time": {"type": "string", "description": "Requested time, e.g. '3 pm' or '15:00'."},
                },
                "required": ["doctor_id", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "confirm_appointment",
            "description": "Confirm and create the appointment. ONLY call after the patient has "
            "explicitly agreed to a specific doctor, date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "integer"},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                    "patient_name": {"type": "string", "description": "Optional patient name."},
                },
                "required": ["doctor_id", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_appointment_confirmation",
            "description": "Retrieve the details of the appointment that was just confirmed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reference": {"type": "string", "description": "Optional appointment reference."}
                },
            },
        },
    },
]


def _dept_dict(db: Session, key: str) -> dict[str, Any] | None:
    dept = db.scalar(select(Department).where(Department.key == key))
    if not dept:
        return None
    return {
        "id": dept.id,
        "key": dept.key,
        "name_en": dept.name_en,
        "name_ar": dept.name_ar,
        "description_en": dept.description_en,
        "description_ar": dept.description_ar,
        "icon": dept.icon,
        "accent": dept.accent,
    }


def _doctor_brief(d) -> dict[str, Any]:
    na = d.next_available
    return {
        "id": d.id,
        "name_en": d.name_en,
        "name_ar": d.name_ar,
        "experience_years": d.experience_years,
        "languages": d.languages,
        "branch_en": d.branch_en,
        "rating": d.rating,
        "next_available": {"date": na.date, "time": na.time} if na else None,
    }


def execute_tool(name: str, args: dict[str, Any], db: Session, state: dict[str, Any]) -> dict[str, Any]:
    """Run a tool, mutate the shared UI ``state`` dict, and return a result for the LLM."""
    try:
        return _dispatch(name, args, db, state)
    except Exception as exc:  # keep the agent loop alive on bad tool args
        return {"error": f"{type(exc).__name__}: {exc}"}


def _dispatch(name: str, args: dict[str, Any], db: Session, state: dict[str, Any]) -> dict[str, Any]:
    if name == "recommend_specialty":
        symptoms = args.get("symptoms", "")
        if specialty.is_emergency(symptoms):
            state["emergency"] = True
            state["phase"] = "emergency"
            return {
                "is_emergency": True,
                "instruction": "Stop booking. Advise the patient to seek urgent emergency care now.",
            }
        rec = specialty.recommend_specialty(symptoms)
        dept = _dept_dict(db, rec["key"])
        state["department"] = dept
        state["phase"] = "recommend"
        return {"is_emergency": False, "department": dept}

    if name == "get_departments":
        depts = [d.model_dump() for d in booking_service.get_departments(db)]
        return {"departments": depts}

    if name == "get_doctors_by_specialty":
        key = args.get("specialty_key", "general")
        doctors = booking_service.get_doctors_by_specialty(db, key, limit=3)
        state["department"] = _dept_dict(db, key)
        state["doctors"] = [d.model_dump() for d in doctors]
        state["phase"] = "doctors"
        return {"doctors": [_doctor_brief(d) for d in doctors]}

    if name == "get_available_slots":
        doctor_id = int(args["doctor_id"])
        on_date = normalize_date(args.get("date"))
        slots = booking_service.get_available_slots(db, doctor_id, on_date)
        state["selected_doctor_id"] = doctor_id
        state["slots"] = [s.model_dump() for s in slots]
        state["phase"] = "slots"
        return {"slots": [{"date": s.date, "time": s.time, "period": s.period} for s in slots[:14]]}

    if name == "find_nearest_available_slot":
        doctor_id = int(args["doctor_id"])
        on_date = normalize_date(args.get("date")) or args.get("date", "")
        time = normalize_time(args.get("time")) or args.get("time", "")
        result = booking_service.find_nearest_available_slot(db, doctor_id, on_date, time)
        state["selected_doctor_id"] = doctor_id
        state["requested_slot"] = result["requested"]
        state["nearest_slot"] = result["nearest"]
        state["slots"] = result["alternatives"]
        state["phase"] = "slots"
        return result

    if name == "confirm_appointment":
        doctor_id = int(args["doctor_id"])
        on_date = normalize_date(args.get("date")) or args.get("date", "")
        time = normalize_time(args.get("time")) or args.get("time", "")
        appt = booking_service.create_appointment(
            db,
            doctor_id=doctor_id,
            on_date=on_date,
            time=time,
            patient_name=args.get("patient_name", "Demo Patient"),
            language=state.get("language", "en"),
        )
        if appt is None:
            result = booking_service.find_nearest_available_slot(db, doctor_id, on_date, time)
            state["nearest_slot"] = result["nearest"]
            state["slots"] = result["alternatives"]
            return {"confirmed": False, "reason": "slot_unavailable", "nearest": result["nearest"]}
        state["appointment"] = appt.model_dump()
        state["phase"] = "confirmed"
        return {"confirmed": True, "appointment": appt.model_dump()}

    if name == "get_appointment_confirmation":
        ref = args.get("reference")
        if ref:
            appt = booking_service.get_appointment_by_reference(db, ref)
            if appt:
                state["appointment"] = appt.model_dump()
                return {"appointment": appt.model_dump()}
        return {"appointment": state.get("appointment")}

    return {"error": f"Unknown tool: {name}"}
