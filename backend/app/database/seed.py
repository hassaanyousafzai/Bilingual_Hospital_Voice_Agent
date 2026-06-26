"""Seeds and resets the SQLite demo database with mock data."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database.db import Base, SessionLocal, engine
from app.models.models import (
    Appointment,
    DemoScenario,
    Department,
    Doctor,
    DoctorAvailability,
    FeedbackAnalysis,
    FeedbackSession,
    Patient,
)
from seed_data.demo_data import (
    BRANCHES,
    DEPARTMENTS,
    DOCTORS,
    FEEDBACK_RECORDS,
    MOCK_COMPLETED_APPOINTMENTS,
    SCENARIOS,
)

MORNING_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
EVENING_SLOTS = ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
AVAILABILITY_DAYS = 14


def _stable_bool(*parts: object, ratio: int = 3) -> bool:
    """Deterministic pseudo-random flag so the demo looks the same on every run."""
    h = abs(hash("|".join(str(p) for p in parts)))
    return (h % 10) < ratio


def _seed_availability(db: Session, doctor: Doctor, work_days: list[int]) -> None:
    today = date.today()
    for offset in range(1, AVAILABILITY_DAYS + 1):
        day = today + timedelta(days=offset)
        if day.weekday() not in work_days:
            continue
        iso = day.isoformat()
        for time in MORNING_SLOTS + EVENING_SLOTS:
            period = "morning" if time in MORNING_SLOTS else "evening"
            booked = _stable_bool(doctor.id, iso, time, ratio=3)
            # Force a realistic "requested time unavailable" demo for cardiology tomorrow.
            if offset == 1 and doctor.department.key == "cardiology" and time in {"10:00", "10:30"}:
                booked = True
            db.add(
                DoctorAvailability(
                    doctor_id=doctor.id, date=iso, time=time, is_booked=booked, period=period
                )
            )


def seed_departments(db: Session) -> dict[str, Department]:
    by_key: dict[str, Department] = {}
    for d in DEPARTMENTS:
        dept = Department(**d)
        db.add(dept)
        by_key[d["key"]] = dept
    db.flush()
    return by_key


def seed_doctors(db: Session, depts: dict[str, Department]) -> None:
    for doc in DOCTORS:
        dept = depts[doc["department"]]
        branch = BRANCHES[doc["branch"]]
        doctor = Doctor(
            name_en=doc["name_en"],
            name_ar=doc["name_ar"],
            department_id=dept.id,
            photo="",
            branch_en=branch["en"],
            branch_ar=branch["ar"],
            experience_years=doc["experience_years"],
            languages=doc["languages"],
            bio_en=doc["bio_en"],
            bio_ar=doc["bio_ar"],
            consultation_duration=doc["consultation_duration"],
            rating=doc["rating"],
        )
        db.add(doctor)
        db.flush()
        _seed_availability(db, doctor, doc["work_days"])


def seed_scenarios(db: Session) -> None:
    for s in SCENARIOS:
        db.add(DemoScenario(**s))


def seed_feedback(db: Session) -> None:
    """Seed completed feedback sessions + analysis for the insights dashboard."""
    for rec in FEEDBACK_RECORDS:
        appt_date = (date.today() - timedelta(days=rec["days_ago"])).isoformat()
        session = FeedbackSession(
            patient_name=rec["patient_name"],
            doctor_name=rec["doctor"],
            department=rec["department"],
            appointment_date=appt_date,
            status="completed",
            language=rec["language"],
            started_at=datetime.utcnow() - timedelta(days=rec["days_ago"]),
            completed_at=datetime.utcnow() - timedelta(days=rec["days_ago"]),
        )
        db.add(session)
        db.flush()
        db.add(
            FeedbackAnalysis(
                session_id=session.id,
                overall_rating=rec["rating"],
                sentiment=rec["sentiment"],
                positive_feedback=rec["positive"],
                issues=rec["issues"],
                categories=rec["categories"],
                priority=rec["priority"],
                summary=rec["summary"],
                created_at=session.completed_at,
            )
        )


def seed_completed_appointments(db: Session) -> None:
    """Seed a few completed appointments the operator can run follow-up calls on."""
    doctors = {d.name_en: d for d in db.scalars(select(Doctor)).all()}
    depts = {d.name_en: d for d in db.scalars(select(Department)).all()}
    for i, rec in enumerate(MOCK_COMPLETED_APPOINTMENTS, start=1):
        doctor = doctors.get(rec["doctor"])
        if not doctor:
            continue
        dept = next((d for d in depts.values() if d.name_en == rec["department"]), doctor.department)
        appt_date = (date.today() - timedelta(days=rec["days_ago"])).isoformat()
        db.add(
            Appointment(
                reference=f"HSP-{7000 + i}",
                doctor_id=doctor.id,
                department_id=dept.id,
                patient_name=rec["patient_name"],
                date=appt_date,
                time="10:00",
                branch=doctor.branch_en,
                status="completed",
                language=rec["language"],
                created_at=datetime.utcnow() - timedelta(days=rec["days_ago"]),
            )
        )


def seed_patients(db: Session) -> None:
    db.add_all(
        [
            Patient(name_en="Demo Patient", name_ar="مريض تجريبي", language="en"),
            Patient(name_en="Sample Patient", name_ar="مريض عينة", language="ar"),
        ]
    )


def is_seeded(db: Session) -> bool:
    return db.scalar(select(func.count()).select_from(Department)) > 0


def seed_all(db: Session) -> None:
    depts = seed_departments(db)
    seed_doctors(db, depts)
    seed_scenarios(db)
    seed_patients(db)
    seed_feedback(db)
    seed_completed_appointments(db)
    db.commit()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if not is_seeded(db):
            seed_all(db)


# ── Reset / reseed operations used by the Demo Data Manager ───────────────────
def reset_appointments(db: Session) -> None:
    db.execute(delete(Appointment))
    db.execute(
        DoctorAvailability.__table__.update().values(is_booked=False)
    )
    db.commit()
    # Re-apply deterministic booking pattern + completed appointments.
    _reapply_booking_pattern(db)
    seed_completed_appointments(db)
    db.commit()


def _reapply_booking_pattern(db: Session) -> None:
    for slot in db.scalars(select(DoctorAvailability)).all():
        booked = _stable_bool(slot.doctor_id, slot.date, slot.time, ratio=3)
        slot.is_booked = booked
    # Force cardiology tomorrow 10:00/10:30 booked again.
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    cardio_ids = [
        d.id
        for d in db.scalars(
            select(Doctor).join(Department).where(Department.key == "cardiology")
        ).all()
    ]
    for slot in db.scalars(
        select(DoctorAvailability).where(
            DoctorAvailability.date == tomorrow,
            DoctorAvailability.time.in_(["10:00", "10:30"]),
            DoctorAvailability.doctor_id.in_(cardio_ids or [-1]),
        )
    ).all():
        slot.is_booked = True


def reset_feedback(db: Session) -> None:
    db.execute(delete(FeedbackAnalysis))
    db.execute(delete(FeedbackSession))
    db.commit()
    seed_feedback(db)
    db.commit()


def full_reset(db: Session) -> None:
    for model in (
        FeedbackAnalysis,
        FeedbackSession,
        Appointment,
        DoctorAvailability,
        Doctor,
        Department,
        DemoScenario,
        Patient,
    ):
        db.execute(delete(model))
    db.commit()
    seed_all(db)
