"""Database-backed booking operations. The agent calls these via tools — it never
invents doctors, slots or confirmation references itself."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.models import Appointment, Department, Doctor, DoctorAvailability
from app.schemas.schemas import (
    AppointmentOut,
    DepartmentOut,
    DoctorCreate,
    DoctorOut,
    SlotOut,
)


def _parse_dt(d: str, t: str) -> datetime:
    return datetime.strptime(f"{d} {t}", "%Y-%m-%d %H:%M")


def get_departments(db: Session) -> list[DepartmentOut]:
    rows = db.scalars(select(Department).order_by(Department.id)).all()
    return [DepartmentOut.model_validate(r) for r in rows]


def _slot_out(slot: DoctorAvailability) -> SlotOut:
    return SlotOut.model_validate(slot)


def _free_slots_query(doctor_id: int):
    today = date.today().isoformat()
    return (
        select(DoctorAvailability)
        .where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.is_booked.is_(False),
            DoctorAvailability.date >= today,
        )
        .order_by(DoctorAvailability.date, DoctorAvailability.time)
    )


def serialize_doctor(db: Session, doctor: Doctor) -> DoctorOut:
    free = db.scalars(_free_slots_query(doctor.id)).all()
    next_slot = _slot_out(free[0]) if free else None
    dates: list[str] = []
    for s in free:
        if s.date not in dates:
            dates.append(s.date)
        if len(dates) >= 7:
            break
    return DoctorOut(
        id=doctor.id,
        name_en=doctor.name_en,
        name_ar=doctor.name_ar,
        department_id=doctor.department_id,
        department_key=doctor.department.key,
        department_name_en=doctor.department.name_en,
        department_name_ar=doctor.department.name_ar,
        photo=doctor.photo,
        branch_en=doctor.branch_en,
        branch_ar=doctor.branch_ar,
        experience_years=doctor.experience_years,
        languages=doctor.languages,
        bio_en=doctor.bio_en,
        bio_ar=doctor.bio_ar,
        consultation_duration=doctor.consultation_duration,
        rating=doctor.rating,
        next_available=next_slot,
        available_dates=dates,
    )


def get_all_doctors(db: Session) -> list[DoctorOut]:
    rows = db.scalars(select(Doctor).order_by(Doctor.id)).all()
    return [serialize_doctor(db, d) for d in rows]


def get_doctor(db: Session, doctor_id: int) -> DoctorOut | None:
    doctor = db.get(Doctor, doctor_id)
    return serialize_doctor(db, doctor) if doctor else None


def get_doctors_by_specialty(db: Session, dept_key: str, limit: int = 3) -> list[DoctorOut]:
    rows = db.scalars(
        select(Doctor).join(Department).where(Department.key == dept_key).order_by(Doctor.id)
    ).all()
    serialized = [serialize_doctor(db, d) for d in rows]
    # Surface doctors with the earliest availability first.
    serialized.sort(
        key=lambda d: (
            d.next_available.date if d.next_available else "9999",
            d.next_available.time if d.next_available else "99:99",
        )
    )
    return serialized[:limit] if limit else serialized


def get_available_slots(db: Session, doctor_id: int, on_date: str | None = None) -> list[SlotOut]:
    query = _free_slots_query(doctor_id)
    if on_date:
        query = (
            select(DoctorAvailability)
            .where(
                DoctorAvailability.doctor_id == doctor_id,
                DoctorAvailability.is_booked.is_(False),
                DoctorAvailability.date == on_date,
            )
            .order_by(DoctorAvailability.time)
        )
    return [_slot_out(s) for s in db.scalars(query).all()]


def find_nearest_available_slot(
    db: Session, doctor_id: int, on_date: str, time: str
) -> dict:
    """Check a requested slot and return the nearest available alternative."""
    requested = db.scalar(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.date == on_date,
            DoctorAvailability.time == time,
        )
    )
    requested_out = _slot_out(requested) if requested else None
    requested_available = bool(requested and not requested.is_booked)

    free = db.scalars(_free_slots_query(doctor_id)).all()
    nearest_out = None
    if requested_available:
        nearest_out = requested_out
    elif free:
        try:
            target = _parse_dt(on_date, time)
        except ValueError:
            target = datetime.now()
        # Prefer the closest slot at or after the requested time, else closest overall.
        later = [s for s in free if _parse_dt(s.date, s.time) >= target]
        pool = later or free
        nearest = min(pool, key=lambda s: abs((_parse_dt(s.date, s.time) - target).total_seconds()))
        nearest_out = _slot_out(nearest)

    alternatives = [
        _slot_out(s)
        for s in free
        if not (nearest_out and s.id == nearest_out.id)
    ][:6]

    return {
        "requested": requested_out.model_dump() if requested_out else None,
        "requested_available": requested_available,
        "nearest": nearest_out.model_dump() if nearest_out else None,
        "alternatives": [a.model_dump() for a in alternatives],
    }


def _next_reference(db: Session) -> str:
    # Patient-facing booking references run from HSP-2048 upward. Seeded completed
    # appointments use a separate (HSP-7xxx) series, so we ignore those here.
    refs = db.scalars(
        select(Appointment.reference).where(Appointment.status == "confirmed")
    ).all()
    nums = []
    for r in refs:
        if r and r.startswith("HSP-"):
            try:
                num = int(r.split("-", 1)[1])
            except ValueError:
                continue
            if num < 7000:
                nums.append(num)
    nxt = max([2047, *nums]) + 1
    return f"HSP-{nxt}"


def create_appointment(
    db: Session,
    doctor_id: int,
    on_date: str,
    time: str,
    patient_name: str = "Demo Patient",
    patient_phone: str = "",
    language: str = "en",
) -> AppointmentOut | None:
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        return None

    slot = db.scalar(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.date == on_date,
            DoctorAvailability.time == time,
        )
    )
    if slot and slot.is_booked:
        return None  # caller should re-check availability
    if slot:
        slot.is_booked = True

    appt = Appointment(
        reference=_next_reference(db),
        doctor_id=doctor.id,
        department_id=doctor.department_id,
        patient_name=patient_name or "Demo Patient",
        patient_phone=patient_phone,
        date=on_date,
        time=time,
        branch=doctor.branch_en,
        status="confirmed",
        language=language,
        created_at=datetime.utcnow(),
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appointment_out(db, appt)


def appointment_out(db: Session, appt: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appt.id,
        reference=appt.reference,
        doctor_id=appt.doctor_id,
        doctor_name_en=appt.doctor.name_en,
        doctor_name_ar=appt.doctor.name_ar,
        department_name_en=appt.department.name_en,
        department_name_ar=appt.department.name_ar,
        patient_name=appt.patient_name,
        date=appt.date,
        time=appt.time,
        branch=appt.branch,
        status=appt.status,
        language=appt.language,
    )


def list_appointments(db: Session, statuses: tuple[str, ...] = ("confirmed", "cancelled")) -> list[AppointmentOut]:
    rows = db.scalars(
        select(Appointment)
        .where(Appointment.status.in_(statuses))
        .order_by(Appointment.created_at.desc())
    ).all()
    return [appointment_out(db, a) for a in rows]


def get_appointment(db: Session, appointment_id: int) -> AppointmentOut | None:
    appt = db.get(Appointment, appointment_id)
    return appointment_out(db, appt) if appt else None


def get_appointment_by_reference(db: Session, reference: str) -> AppointmentOut | None:
    appt = db.scalar(select(Appointment).where(Appointment.reference == reference))
    return appointment_out(db, appt) if appt else None


def cancel_appointment(db: Session, appointment_id: int) -> bool:
    appt = db.get(Appointment, appointment_id)
    if not appt:
        return False
    appt.status = "cancelled"
    slot = db.scalar(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == appt.doctor_id,
            DoctorAvailability.date == appt.date,
            DoctorAvailability.time == appt.time,
        )
    )
    if slot:
        slot.is_booked = False
    db.commit()
    return True


# ── Doctor management (Doctors directory) ────────────────────────────────────
def _generate_availability(db: Session, doctor: Doctor, work_days: list[int]) -> None:
    from datetime import date as _date, timedelta

    from app.database.seed import EVENING_SLOTS, MORNING_SLOTS, _stable_bool

    today = _date.today()
    days = work_days or [0, 1, 2, 3, 4, 5, 6]
    for offset in range(1, 15):
        day = today + timedelta(days=offset)
        if day.weekday() not in days:
            continue
        iso = day.isoformat()
        for time in MORNING_SLOTS + EVENING_SLOTS:
            period = "morning" if time in MORNING_SLOTS else "evening"
            db.add(
                DoctorAvailability(
                    doctor_id=doctor.id,
                    date=iso,
                    time=time,
                    is_booked=_stable_bool(doctor.id, iso, time, ratio=2),
                    period=period,
                )
            )


def create_doctor(db: Session, data: DoctorCreate) -> DoctorOut | None:
    dept = db.scalar(select(Department).where(Department.key == data.department_key))
    if not dept:
        return None
    doctor = Doctor(
        name_en=data.name_en.strip(),
        name_ar=data.name_ar.strip(),
        department_id=dept.id,
        photo="",
        branch_en=data.branch_en.strip(),
        branch_ar=(data.branch_ar or data.branch_en).strip(),
        experience_years=max(0, data.experience_years),
        languages=data.languages or ["English"],
        bio_en=data.bio_en,
        bio_ar=data.bio_ar or data.bio_en,
        consultation_duration=data.consultation_duration or 30,
        rating=min(5.0, max(0.0, data.rating)),
    )
    db.add(doctor)
    db.flush()
    _generate_availability(db, doctor, data.work_days)
    db.commit()
    db.refresh(doctor)
    return serialize_doctor(db, doctor)


def delete_doctor(db: Session, doctor_id: int) -> tuple[bool, str]:
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        return False, "not_found"
    appt_count = db.scalar(
        select(func.count()).select_from(Appointment).where(Appointment.doctor_id == doctor_id)
    )
    if appt_count:
        return False, "has_appointments"
    db.delete(doctor)  # availability is cascade-deleted
    db.commit()
    return True, "deleted"
