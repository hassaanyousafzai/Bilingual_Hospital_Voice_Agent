from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.schemas import (
    FeedbackAnswerIn,
    FeedbackAnswerOut,
    FeedbackCompleteOut,
    FeedbackRecordOut,
    FeedbackSessionStart,
    FeedbackSessionStartOut,
    InsightsOut,
    MockAppointmentOut,
)
from app.services import feedback_service

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class CompleteIn(BaseModel):
    session_id: int


@router.get("/mock-appointments", response_model=list[MockAppointmentOut])
def mock_appointments(db: Session = Depends(get_db)):
    return feedback_service.get_mock_appointments(db)


@router.post("/session/start", response_model=FeedbackSessionStartOut)
def start(payload: FeedbackSessionStart, db: Session = Depends(get_db)):
    result = feedback_service.start_session(db, payload.appointment_id, payload.language)
    if result is None:
        raise HTTPException(status_code=404, detail="appointment_not_found")
    return result


@router.post("/session/answer", response_model=FeedbackAnswerOut)
def answer(payload: FeedbackAnswerIn, db: Session = Depends(get_db)):
    result = feedback_service.save_answer(db, payload.session_id, payload.question_key, payload.answer_text)
    if result is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    return result


@router.post("/session/complete", response_model=FeedbackCompleteOut)
def complete(payload: CompleteIn, db: Session = Depends(get_db)):
    result = feedback_service.complete_session(db, payload.session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    return result


@router.get("/insights", response_model=InsightsOut)
def insights(db: Session = Depends(get_db)):
    return feedback_service.get_insights(db)


@router.get("/records", response_model=list[FeedbackRecordOut])
def records(db: Session = Depends(get_db)):
    return feedback_service.get_records(db)
