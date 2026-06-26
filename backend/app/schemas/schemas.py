from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Language = Literal["en", "ar"]


# ── Directory ────────────────────────────────────────────────────────────────
class DepartmentOut(BaseModel):
    id: int
    key: str
    name_en: str
    name_ar: str
    description_en: str
    description_ar: str
    icon: str
    accent: str

    class Config:
        from_attributes = True


class SlotOut(BaseModel):
    id: int
    date: str
    time: str
    period: str
    is_booked: bool

    class Config:
        from_attributes = True


class DoctorOut(BaseModel):
    id: int
    name_en: str
    name_ar: str
    department_id: int
    department_key: str
    department_name_en: str
    department_name_ar: str
    photo: str
    branch_en: str
    branch_ar: str
    experience_years: int
    languages: list[str]
    bio_en: str
    bio_ar: str
    consultation_duration: int
    rating: float
    next_available: Optional[SlotOut] = None
    available_dates: list[str] = []


class DoctorCreate(BaseModel):
    name_en: str = Field(min_length=2)
    name_ar: str = Field(min_length=2)
    department_key: str
    branch_en: str = "Al Noor Medical City — Tower A"
    branch_ar: str = ""
    experience_years: int = 5
    languages: list[str] = ["English", "Arabic"]
    bio_en: str = ""
    bio_ar: str = ""
    consultation_duration: int = 30
    rating: float = 4.7
    work_days: list[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Mon … 6=Sun


# ── Appointments ─────────────────────────────────────────────────────────────
class AppointmentCreate(BaseModel):
    doctor_id: int
    date: str
    time: str
    patient_name: str = "Demo Patient"
    patient_phone: str = ""
    language: Language = "en"


class AppointmentOut(BaseModel):
    id: int
    reference: str
    doctor_id: int
    doctor_name_en: str
    doctor_name_ar: str
    department_name_en: str
    department_name_ar: str
    patient_name: str
    date: str
    time: str
    branch: str
    status: str
    language: str

    class Config:
        from_attributes = True


# ── Voice / Agent session ────────────────────────────────────────────────────
class SessionStart(BaseModel):
    language: Language = "en"
    scenario: Optional[str] = None


class SessionStartOut(BaseModel):
    session_id: str
    greeting: str
    language: Language


class SessionMessage(BaseModel):
    session_id: str
    message: str
    language: Optional[Language] = None


class AgentState(BaseModel):
    phase: str = "intake"  # intake | recommend | doctors | slots | confirmed | emergency
    emergency: bool = False
    department: Optional[DepartmentOut] = None
    doctors: list[DoctorOut] = []
    slots: list[SlotOut] = []
    selected_doctor_id: Optional[int] = None
    requested_slot: Optional[SlotOut] = None
    nearest_slot: Optional[SlotOut] = None
    appointment: Optional[AppointmentOut] = None


class SessionMessageOut(BaseModel):
    session_id: str
    reply: str
    language: Language
    status: str = "speaking"
    state: AgentState
    tools_used: list[str] = []


class TranscribeOut(BaseModel):
    text: str
    language: Optional[str] = None


# ── Feedback ─────────────────────────────────────────────────────────────────
class MockAppointmentOut(BaseModel):
    id: int
    reference: str
    patient_name: str
    doctor_name_en: str
    doctor_name_ar: str
    department: str
    date: str
    time: str
    language: str


class FeedbackSessionStart(BaseModel):
    appointment_id: int
    language: Language = "en"


class FeedbackQuestion(BaseModel):
    key: str
    order: int
    text_en: str
    text_ar: str


class FeedbackSessionStartOut(BaseModel):
    session_id: int
    patient_name: str
    doctor_name: str
    department: str
    appointment_date: str
    language: Language
    greeting: str
    questions: list[FeedbackQuestion]
    first_question: str


class FeedbackAnswerIn(BaseModel):
    session_id: int
    question_key: str
    answer_text: str


class FeedbackAnswerOut(BaseModel):
    acknowledgement: str
    next_question: Optional[str] = None
    next_question_key: Optional[str] = None
    progress: int
    total: int
    done: bool


class FeedbackAnalysisOut(BaseModel):
    overall_rating: int
    sentiment: str
    positive_feedback: list[str]
    issues: list[str]
    categories: list[str]
    priority: str
    summary: str


class FeedbackCompleteOut(BaseModel):
    session_id: int
    closing_message: str
    analysis: FeedbackAnalysisOut


class FeedbackRecordOut(BaseModel):
    session_id: int
    patient_name: str
    doctor_name: str
    department: str
    appointment_date: str
    language: str
    analysis: FeedbackAnalysisOut
    answers: list[dict[str, Any]] = []


class InsightsOut(BaseModel):
    total_feedback_calls: int
    average_rating: float
    positive_sentiment_pct: float
    negative_feedback_count: int
    most_mentioned_issue: str
    sentiment_distribution: dict[str, int]
    rating_distribution: dict[str, int]
    issue_frequency: list[dict[str, Any]]
    feedback_trend: list[dict[str, Any]]
    doctor_ranking: list[dict[str, Any]]


# ── Demo management ──────────────────────────────────────────────────────────
class ScenarioOut(BaseModel):
    key: str
    name_en: str
    name_ar: str
    description_en: str
    description_ar: str
    config: dict

    class Config:
        from_attributes = True


class LoadScenarioIn(BaseModel):
    key: str


class SimpleMessage(BaseModel):
    message: str
