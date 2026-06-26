from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.schemas import (
    AppointmentCreate,
    AppointmentOut,
    DepartmentOut,
    DoctorCreate,
    DoctorOut,
    SimpleMessage,
    SlotOut,
)
from app.services import booking_service

router = APIRouter(prefix="/api", tags=["appointments"])


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return booking_service.get_departments(db)


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(specialty: str | None = Query(default=None), db: Session = Depends(get_db)):
    if specialty:
        return booking_service.get_doctors_by_specialty(db, specialty, limit=0)
    return booking_service.get_all_doctors(db)


@router.post("/doctors", response_model=DoctorOut)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)):
    doctor = booking_service.create_doctor(db, payload)
    if doctor is None:
        raise HTTPException(status_code=400, detail="invalid_department")
    return doctor


@router.get("/doctors/{doctor_id}", response_model=DoctorOut)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = booking_service.get_doctor(db, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="doctor_not_found")
    return doctor


@router.delete("/doctors/{doctor_id}", response_model=SimpleMessage)
def delete_doctor(doctor_id: int, db: Session = Depends(get_db)):
    ok, reason = booking_service.delete_doctor(db, doctor_id)
    if not ok:
        if reason == "has_appointments":
            raise HTTPException(status_code=409, detail="doctor_has_appointments")
        raise HTTPException(status_code=404, detail="doctor_not_found")
    return SimpleMessage(message="Doctor removed.")


@router.get("/availability", response_model=list[SlotOut])
def availability(
    doctor_id: int = Query(...),
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return booking_service.get_available_slots(db, doctor_id, date)


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(db: Session = Depends(get_db)):
    return booking_service.list_appointments(db)


@router.post("/appointments", response_model=AppointmentOut)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    appt = booking_service.create_appointment(
        db,
        doctor_id=payload.doctor_id,
        on_date=payload.date,
        time=payload.time,
        patient_name=payload.patient_name,
        patient_phone=payload.patient_phone,
        language=payload.language,
    )
    if appt is None:
        raise HTTPException(status_code=409, detail="slot_unavailable")
    return appt


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appt = booking_service.get_appointment(db, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="appointment_not_found")
    return appt


@router.post("/appointments/{appointment_id}/cancel", response_model=SimpleMessage)
def cancel_appointment(appointment_id: int, db: Session = Depends(get_db)):
    ok = booking_service.cancel_appointment(db, appointment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="appointment_not_found")
    return SimpleMessage(message="Appointment cancelled.")
