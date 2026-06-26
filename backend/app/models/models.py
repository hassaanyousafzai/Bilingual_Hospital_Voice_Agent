from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String)
    name_ar: Mapped[str] = mapped_column(String)
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_ar: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String, default="stethoscope")
    accent: Mapped[str] = mapped_column(String, default="#2563eb")

    doctors: Mapped[list[Doctor]] = relationship(back_populates="department")


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_en: Mapped[str] = mapped_column(String)
    name_ar: Mapped[str] = mapped_column(String)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    photo: Mapped[str] = mapped_column(String, default="")
    branch_en: Mapped[str] = mapped_column(String)
    branch_ar: Mapped[str] = mapped_column(String)
    experience_years: Mapped[int] = mapped_column(Integer, default=5)
    languages: Mapped[list] = mapped_column(JSON, default=list)
    bio_en: Mapped[str] = mapped_column(Text, default="")
    bio_ar: Mapped[str] = mapped_column(Text, default="")
    consultation_duration: Mapped[int] = mapped_column(Integer, default=30)
    rating: Mapped[float] = mapped_column(Float, default=4.7)

    department: Mapped[Department] = relationship(back_populates="doctors")
    availability: Mapped[list[DoctorAvailability]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    date: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM-DD
    time: Mapped[str] = mapped_column(String)  # HH:MM (24h)
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False)
    period: Mapped[str] = mapped_column(String, default="morning")  # morning | evening

    doctor: Mapped[Doctor] = relationship(back_populates="availability")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_en: Mapped[str] = mapped_column(String)
    name_ar: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String, default="")
    language: Mapped[str] = mapped_column(String, default="en")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String, unique=True, index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    patient_name: Mapped[str] = mapped_column(String, default="Demo Patient")
    patient_phone: Mapped[str] = mapped_column(String, default="")
    date: Mapped[str] = mapped_column(String)
    time: Mapped[str] = mapped_column(String)
    branch: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="confirmed")  # confirmed|cancelled|completed
    language: Mapped[str] = mapped_column(String, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    doctor: Mapped[Doctor] = relationship()
    department: Mapped[Department] = relationship()


class FeedbackSession(Base):
    __tablename__ = "feedback_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"), nullable=True)
    patient_name: Mapped[str] = mapped_column(String)
    doctor_name: Mapped[str] = mapped_column(String)
    department: Mapped[str] = mapped_column(String, default="")
    appointment_date: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="in_progress")  # in_progress|completed
    language: Mapped[str] = mapped_column(String, default="en")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    answers: Mapped[list[FeedbackAnswer]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    analysis: Mapped[FeedbackAnalysis | None] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )


class FeedbackAnswer(Base):
    __tablename__ = "feedback_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("feedback_sessions.id"))
    question_key: Mapped[str] = mapped_column(String)
    question_text: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str] = mapped_column(Text, default="")
    order: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped[FeedbackSession] = relationship(back_populates="answers")


class FeedbackAnalysis(Base):
    __tablename__ = "feedback_analysis"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("feedback_sessions.id"))
    overall_rating: Mapped[int] = mapped_column(Integer, default=3)
    sentiment: Mapped[str] = mapped_column(String, default="Neutral")
    positive_feedback: Mapped[list] = mapped_column(JSON, default=list)
    issues: Mapped[list] = mapped_column(JSON, default=list)
    categories: Mapped[list] = mapped_column(JSON, default=list)
    priority: Mapped[str] = mapped_column(String, default="Low")
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped[FeedbackSession] = relationship(back_populates="analysis")


class DemoScenario(Base):
    __tablename__ = "demo_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String)
    name_ar: Mapped[str] = mapped_column(String)
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_ar: Mapped[str] = mapped_column(Text, default="")
    config: Mapped[dict] = mapped_column(JSON, default=dict)
