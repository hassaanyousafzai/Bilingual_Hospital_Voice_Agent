"""Feedback session lifecycle and insights aggregation."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents import feedback_agent
from app.models.models import (
    Appointment,
    FeedbackAnalysis,
    FeedbackAnswer,
    FeedbackSession,
)
from app.schemas.schemas import (
    FeedbackAnalysisOut,
    FeedbackAnswerOut,
    FeedbackCompleteOut,
    FeedbackQuestion,
    FeedbackRecordOut,
    FeedbackSessionStartOut,
    InsightsOut,
    MockAppointmentOut,
)

CATEGORY_LABELS = {
    "booking_experience": "Booking experience",
    "waiting_time": "Waiting time",
    "check_in_process": "Check-in process",
    "doctor_feedback": "Doctor feedback",
    "consultation_quality": "Consultation quality",
    "staff_behavior": "Staff behaviour",
    "facilities": "Facilities",
    "communication": "Communication",
}
ISSUE_CATEGORIES = {
    "booking_experience", "waiting_time", "check_in_process",
    "consultation_quality", "staff_behavior", "facilities", "communication",
}


def get_mock_appointments(db: Session) -> list[MockAppointmentOut]:
    rows = db.scalars(
        select(Appointment).where(Appointment.status == "completed").order_by(Appointment.date.desc())
    ).all()
    return [
        MockAppointmentOut(
            id=a.id,
            reference=a.reference,
            patient_name=a.patient_name,
            doctor_name_en=a.doctor.name_en,
            doctor_name_ar=a.doctor.name_ar,
            department=a.department.name_en,
            date=a.date,
            time=a.time,
            language=a.language,
        )
        for a in rows
    ]


def start_session(db: Session, appointment_id: int, language: str) -> FeedbackSessionStartOut | None:
    appt = db.get(Appointment, appointment_id)
    if not appt:
        return None
    doctor_name = appt.doctor.name_ar if language == "ar" else appt.doctor.name_en
    session = FeedbackSession(
        appointment_id=appt.id,
        patient_name=appt.patient_name,
        doctor_name=appt.doctor.name_en,
        department=appt.department.name_en,
        appointment_date=appt.date,
        status="in_progress",
        language=language,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    questions = [
        FeedbackQuestion(key=q["key"], order=i, text_en=q["text_en"], text_ar=q["text_ar"])
        for i, q in enumerate(feedback_agent.QUESTIONS)
    ]
    return FeedbackSessionStartOut(
        session_id=session.id,
        patient_name=appt.patient_name,
        doctor_name=doctor_name,
        department=appt.department.name_en,
        appointment_date=appt.date,
        language=language,
        greeting=feedback_agent.greeting(appt.patient_name, doctor_name, language),
        questions=questions,
        first_question=feedback_agent.question_text(feedback_agent.QUESTIONS[0], language),
    )


def _question_index(key: str) -> int:
    for i, q in enumerate(feedback_agent.QUESTIONS):
        if q["key"] == key:
            return i
    return -1


def save_answer(db: Session, session_id: int, question_key: str, answer_text: str) -> FeedbackAnswerOut | None:
    session = db.get(FeedbackSession, session_id)
    if not session:
        return None
    idx = _question_index(question_key)
    q = feedback_agent.QUESTIONS[idx]
    db.add(
        FeedbackAnswer(
            session_id=session.id,
            question_key=question_key,
            question_text=q["text_en"],
            answer_text=answer_text,
            order=idx,
        )
    )
    db.commit()

    total = len(feedback_agent.QUESTIONS)
    next_idx = idx + 1
    done = next_idx >= total
    next_q = None if done else feedback_agent.question_text(feedback_agent.QUESTIONS[next_idx], session.language)
    next_key = None if done else feedback_agent.QUESTIONS[next_idx]["key"]
    ack = feedback_agent.acknowledge(answer_text, next_q, session.language)

    return FeedbackAnswerOut(
        acknowledgement=ack,
        next_question=next_q,
        next_question_key=next_key,
        progress=next_idx,
        total=total,
        done=done,
    )


def complete_session(db: Session, session_id: int) -> FeedbackCompleteOut | None:
    session = db.get(FeedbackSession, session_id)
    if not session:
        return None

    answers = {a.question_key: a.answer_text for a in session.answers}
    result = feedback_agent.analyze_feedback(answers, session.language)

    analysis = db.scalar(select(FeedbackAnalysis).where(FeedbackAnalysis.session_id == session.id))
    if analysis is None:
        analysis = FeedbackAnalysis(session_id=session.id)
        db.add(analysis)
    analysis.overall_rating = result["overall_rating"]
    analysis.sentiment = result["sentiment"]
    analysis.positive_feedback = result["positive_feedback"]
    analysis.issues = result["issues"]
    analysis.categories = result["categories"]
    analysis.priority = result["priority"]
    analysis.summary = result["summary"]
    analysis.created_at = datetime.utcnow()

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()

    return FeedbackCompleteOut(
        session_id=session.id,
        closing_message=feedback_agent.closing(session.language),
        analysis=FeedbackAnalysisOut(**result),
    )


def get_records(db: Session) -> list[FeedbackRecordOut]:
    rows = db.scalars(
        select(FeedbackSession)
        .where(FeedbackSession.status == "completed")
        .order_by(FeedbackSession.completed_at.desc())
    ).all()
    records: list[FeedbackRecordOut] = []
    for s in rows:
        if not s.analysis:
            continue
        records.append(
            FeedbackRecordOut(
                session_id=s.id,
                patient_name=s.patient_name,
                doctor_name=s.doctor_name,
                department=s.department,
                appointment_date=s.appointment_date,
                language=s.language,
                analysis=FeedbackAnalysisOut(
                    overall_rating=s.analysis.overall_rating,
                    sentiment=s.analysis.sentiment,
                    positive_feedback=s.analysis.positive_feedback,
                    issues=s.analysis.issues,
                    categories=s.analysis.categories,
                    priority=s.analysis.priority,
                    summary=s.analysis.summary,
                ),
                answers=[
                    {"question": a.question_text, "answer": a.answer_text} for a in s.answers
                ],
            )
        )
    return records


def get_insights(db: Session) -> InsightsOut:
    rows = db.scalars(
        select(FeedbackSession).where(FeedbackSession.status == "completed")
    ).all()
    analyses = [(s, s.analysis) for s in rows if s.analysis]
    total = len(analyses)

    if total == 0:
        return InsightsOut(
            total_feedback_calls=0, average_rating=0.0, positive_sentiment_pct=0.0,
            negative_feedback_count=0, most_mentioned_issue="—",
            sentiment_distribution={"Positive": 0, "Neutral": 0, "Negative": 0},
            rating_distribution={str(i): 0 for i in range(1, 6)},
            issue_frequency=[], feedback_trend=[], doctor_ranking=[],
        )

    ratings = [a.overall_rating for _, a in analyses]
    avg_rating = round(sum(ratings) / total, 2)

    sentiment_dist = {"Positive": 0, "Neutral": 0, "Negative": 0}
    for _, a in analyses:
        sentiment_dist[a.sentiment] = sentiment_dist.get(a.sentiment, 0) + 1
    positive_pct = round(sentiment_dist["Positive"] / total * 100, 1)
    negative_count = sentiment_dist["Negative"]

    rating_dist = {str(i): 0 for i in range(1, 6)}
    for r in ratings:
        rating_dist[str(r)] = rating_dist.get(str(r), 0) + 1

    cat_counter: Counter = Counter()
    for _, a in analyses:
        for c in a.categories or []:
            cat_counter[c] += 1
    issue_frequency = [
        {"category": c, "label": CATEGORY_LABELS.get(c, c), "count": n}
        for c, n in cat_counter.most_common()
    ]
    issue_only = [(c, n) for c, n in cat_counter.most_common() if c in ISSUE_CATEGORIES]
    most_mentioned = CATEGORY_LABELS.get(issue_only[0][0], "—") if issue_only else "—"

    trend_map: dict[str, list[int]] = defaultdict(list)
    for s, a in analyses:
        trend_map[s.appointment_date].append(a.overall_rating)
    feedback_trend = [
        {"date": d, "count": len(v), "avg_rating": round(sum(v) / len(v), 2)}
        for d, v in sorted(trend_map.items())
    ][-10:]

    doc_map: dict[str, list[int]] = defaultdict(list)
    for s, a in analyses:
        doc_map[s.doctor_name].append(a.overall_rating)
    doctor_ranking = sorted(
        [
            {"doctor": d, "avg_rating": round(sum(v) / len(v), 2), "count": len(v)}
            for d, v in doc_map.items()
        ],
        key=lambda x: x["avg_rating"],
        reverse=True,
    )

    return InsightsOut(
        total_feedback_calls=total,
        average_rating=avg_rating,
        positive_sentiment_pct=positive_pct,
        negative_feedback_count=negative_count,
        most_mentioned_issue=most_mentioned,
        sentiment_distribution=sentiment_dist,
        rating_distribution=rating_dist,
        issue_frequency=issue_frequency,
        feedback_trend=feedback_trend,
        doctor_ranking=doctor_ranking,
    )
