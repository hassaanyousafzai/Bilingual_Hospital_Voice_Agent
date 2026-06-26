import random
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import seed as seed_module
from app.database.db import get_db
from app.models.models import Appointment, Department, Doctor, FeedbackSession
from app.schemas.schemas import LoadScenarioIn, ScenarioOut, SimpleMessage
from app.services import groq_service
from app.services.feedback_service import get_mock_appointments

router = APIRouter(prefix="/api/demo", tags=["demo"])

_DEMO_PATIENTS = [
    "Omar Farouk", "Layla Ahmed", "James Carter", "Sofia Reyes",
    "Hassan Ali", "Mia Chen", "Nour Khalil", "Ethan Walker",
]


class ResetIn(BaseModel):
    scope: str = "all"  # all | appointments | feedback


class MockAppointmentIn(BaseModel):
    language: str = "en"


@router.get("/status")
def status(db: Session = Depends(get_db)):
    provider = settings.active_llm_provider
    model = (
        settings.gemini_chat_model if provider == "gemini"
        else settings.groq_model if provider == "groq"
        else None
    )
    return {
        "llm_enabled": settings.llm_enabled,
        "provider": provider,
        "model": model,
        "counts": {
            "doctors": db.query(Doctor).count(),
            "departments": db.query(Department).count(),
            "appointments": db.query(Appointment).count(),
            "completed_appointments": db.query(Appointment).filter(Appointment.status == "completed").count(),
            "feedback_sessions": db.query(FeedbackSession).filter(FeedbackSession.status == "completed").count(),
        },
    }


@router.post("/reset", response_model=SimpleMessage)
def reset(payload: ResetIn, db: Session = Depends(get_db)):
    if payload.scope == "appointments":
        seed_module.reset_appointments(db)
        return SimpleMessage(message="Appointments and availability reset.")
    if payload.scope == "feedback":
        seed_module.reset_feedback(db)
        return SimpleMessage(message="Feedback records reset.")
    seed_module.full_reset(db)
    return SimpleMessage(message="All demo data reset.")


@router.post("/seed", response_model=SimpleMessage)
def seed(db: Session = Depends(get_db)):
    seed_module.full_reset(db)
    return SimpleMessage(message="Demo data reseeded (doctors, availability, feedback).")


@router.post("/mock-appointment")
def create_mock_appointment(payload: MockAppointmentIn, db: Session = Depends(get_db)):
    doctors = db.scalars(select(Doctor)).all()
    if not doctors:
        raise HTTPException(status_code=400, detail="no_doctors_seeded")
    doctor = random.choice(doctors)
    refs = [a.reference for a in db.scalars(select(Appointment)).all() if a.reference.startswith("HSP-")]
    nums = [int(r.split("-")[1]) for r in refs if r.split("-")[1].isdigit()]
    ref = f"HSP-{max([7000, *nums]) + 1}"
    appt = Appointment(
        reference=ref,
        doctor_id=doctor.id,
        department_id=doctor.department_id,
        patient_name=random.choice(_DEMO_PATIENTS),
        date=(date.today() - timedelta(days=1)).isoformat(),
        time="10:00",
        branch=doctor.branch_en,
        status="completed",
        language=payload.language,
        created_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add(appt)
    db.commit()
    return {"message": "Mock completed appointment created.", "appointments": [m.model_dump() for m in get_mock_appointments(db)]}


@router.get("/scenarios", response_model=list[ScenarioOut])
def scenarios(db: Session = Depends(get_db)):
    from app.models.models import DemoScenario

    rows = db.scalars(select(DemoScenario).order_by(DemoScenario.id)).all()
    return [ScenarioOut.model_validate(r) for r in rows]


@router.post("/load-scenario")
def load_scenario(payload: LoadScenarioIn, db: Session = Depends(get_db)):
    from app.models.models import DemoScenario

    scenario = db.scalar(select(DemoScenario).where(DemoScenario.key == payload.key))
    if not scenario:
        raise HTTPException(status_code=404, detail="scenario_not_found")
    config = scenario.config or {}
    return {
        "key": scenario.key,
        "name_en": scenario.name_en,
        "name_ar": scenario.name_ar,
        "flow": config.get("flow", "booking"),
        "sample_en": config.get("sample_en", ""),
        "sample_ar": config.get("sample_ar", ""),
        "config": config,
    }
