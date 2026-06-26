"""Post-appointment feedback agent: question script, spoken acknowledgements, and
structured analysis (LLM with a deterministic rule-based fallback)."""

from __future__ import annotations

import re

from app.prompts.prompts import feedback_ack_prompt, feedback_analysis_prompt
from app.services import llm_service

QUESTIONS = [
    {
        "key": "booking",
        "text_en": "How easy was it to book your appointment?",
        "text_ar": "ما مدى سهولة حجز موعدك؟",
    },
    {
        "key": "waiting",
        "text_en": "How was your waiting time at the hospital?",
        "text_ar": "كيف كان وقت الانتظار في المستشفى؟",
    },
    {
        "key": "consultation",
        "text_en": "Were you satisfied with your consultation with the doctor?",
        "text_ar": "هل كنت راضياً عن استشارتك مع الطبيب؟",
    },
    {
        "key": "issues",
        "text_en": "Did you experience any issue during your hospital visit?",
        "text_ar": "هل واجهت أي مشكلة أثناء زيارتك للمستشفى؟",
    },
    {
        "key": "overall",
        "text_en": "Overall, how would you rate your experience from one to five?",
        "text_ar": "بشكل عام، كيف تقيّم تجربتك من واحد إلى خمسة؟",
    },
]


def question_text(q: dict, language: str) -> str:
    return q["text_ar"] if language == "ar" else q["text_en"]


def greeting(patient_name: str, doctor_name: str, language: str) -> str:
    if language == "ar":
        return (
            f"مرحباً {patient_name}، أتصل بك من المستشفى لأخذ رأيك حول زيارتك الأخيرة مع {doctor_name}. "
            "سأطرح عليك بضعة أسئلة قصيرة. " + QUESTIONS[0]["text_ar"]
        )
    return (
        f"Hello {patient_name}, this is a quick follow-up call from the hospital about your recent visit "
        f"with {doctor_name}. I'll ask you a few short questions. " + QUESTIONS[0]["text_en"]
    )


def closing(language: str) -> str:
    if language == "ar":
        return "شكراً جزيلاً على وقتك وملاحظاتك القيّمة. نتمنى لك دوام الصحة والعافية."
    return "Thank you so much for your time and valuable feedback. We wish you good health."


def acknowledge(answer_text: str, next_question: str | None, language: str) -> str:
    """One short empathetic line + the next question. Uses LLM if available."""
    if not next_question:
        return closing(language)
    if llm_service.llm_available():
        messages = [
            {"role": "system", "content": feedback_ack_prompt(language)},
            {
                "role": "user",
                "content": f'The patient just answered: "{answer_text}". '
                f'Now ask this next question naturally: "{next_question}"',
            },
        ]
        text = llm_service.chat_text(messages, temperature=0.5)
        if text:
            return text
    # Fallback template.
    if language == "ar":
        return f"شكراً لك على ملاحظتك. {next_question}"
    return f"Thank you for sharing that. {next_question}"


# ── Analysis ─────────────────────────────────────────────────────────────────
VALID_CATEGORIES = {
    "booking_experience", "waiting_time", "check_in_process", "doctor_feedback",
    "consultation_quality", "staff_behavior", "facilities", "communication",
}

_NEG_MAP = [
    (["long wait", "waited", "waiting", "an hour", "two hours", "hour", "delay", "delayed", "انتظر", "انتظار", "ساعة", "ساعتين", "تأخير", "طويل"],
     "Long waiting time", "waiting_time"),
    (["confusing", "confused", "check-in", "check in", "checkin", "reception", "فوضى", "مربك", "استقبال", "تسجيل"],
     "Confusing check-in process", "check_in_process"),
    (["rude", "unhelpful", "impolite", "staff were", "وقح", "غير متعاون", "سيء المعاملة"],
     "Unhelpful or rude staff", "staff_behavior"),
    (["rushed", "did not listen", "didn't listen", "not listen", "متعجل", "لم يستمع", "مستعجل"],
     "Felt rushed during consultation", "consultation_quality"),
    (["dirty", "crowded", "parking", "noisy", "متسخ", "مزدحم", "موقف", "ضوضاء"],
     "Facility or environment problem", "facilities"),
    (["hard to book", "couldn't book", "could not book", "phone", "difficult to book", "صعب الحجز", "هاتف"],
     "Difficulty booking the appointment", "booking_experience"),
]

_POS_MAP = [
    (["excellent", "great", "wonderful", "amazing", "perfect", "ممتاز", "رائع", "ممتازة"],
     "Excellent overall experience", "doctor_feedback"),
    (["helpful", "clear", "explained", "thorough", "knowledgeable", "مفيد", "واضح", "شرح", "متمكن"],
     "Doctor explained things clearly", "doctor_feedback"),
    (["friendly", "kind", "polite", "caring", "لطيف", "ودود", "مهذب", "متعاون"],
     "Friendly and caring staff", "staff_behavior"),
    (["easy to book", "simple", "quick booking", "سهل الحجز", "بسيط", "سهل"],
     "Easy booking process", "booking_experience"),
    (["clean", "comfortable", "نظيف", "مريح"],
     "Clean and comfortable facility", "facilities"),
    (["short wait", "no wait", "on time", "quick", "fast", "لا انتظار", "بسرعة", "في الوقت"],
     "Short waiting time", "waiting_time"),
]

_RATING_WORDS = {
    5: ["excellent", "amazing", "wonderful", "perfect", "five", "5", "ممتاز", "خمسة", "رائع"],
    4: ["very good", "good", "great", "four", "4", "جيد جدا", "جيد", "اربعة", "أربعة"],
    3: ["okay", "ok", "average", "fine", "neutral", "three", "3", "مقبول", "عادي", "ثلاثة"],
    2: ["poor", "bad", "two", "2", "سيء", "اثنان", "اثنين"],
    1: ["terrible", "awful", "horrible", "worst", "one", "1", "سيئ جدا", "فظيع", "واحد"],
}


def _extract_rating(answers: dict[str, str]) -> int | None:
    overall = answers.get("overall", "")
    m = re.search(r"\b([1-5])\b", overall)
    if m:
        return int(m.group(1))
    low = overall.lower()
    for score, words in _RATING_WORDS.items():
        if any(w in low for w in words):
            return score
    return None


def _rule_based_analysis(answers: dict[str, str]) -> dict:
    blob = " ".join(answers.values()).lower()

    issues, issue_cats = [], []
    for keys, phrase, cat in _NEG_MAP:
        if any(k in blob for k in keys):
            issues.append(phrase)
            issue_cats.append(cat)

    positives, pos_cats = [], []
    for keys, phrase, cat in _POS_MAP:
        if any(k in blob for k in keys):
            positives.append(phrase)
            pos_cats.append(cat)

    rating = _extract_rating(answers)
    if rating is None:
        if issues and not positives:
            rating = 2
        elif positives and not issues:
            rating = 5
        elif positives and issues:
            rating = 3
        else:
            rating = 3

    if rating >= 4:
        sentiment = "Positive"
    elif rating <= 2:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    if rating <= 2 or len(issues) >= 3:
        priority = "High"
    elif rating == 3 or issues:
        priority = "Medium"
    else:
        priority = "Low"

    categories = list(dict.fromkeys(issue_cats + pos_cats + ["doctor_feedback"]))[:4]

    if sentiment == "Positive" and not issues:
        summary = "The patient was satisfied overall and praised the visit."
    elif sentiment == "Negative":
        summary = "The patient was dissatisfied, raising: " + ", ".join(issues[:2]).lower() + "."
    else:
        good = positives[0].lower() if positives else "the doctor"
        bad = issues[0].lower() if issues else "some delays"
        summary = f"The patient appreciated {good} but reported {bad}."

    return {
        "overall_rating": rating,
        "sentiment": sentiment,
        "positive_feedback": positives[:4],
        "issues": issues[:4],
        "categories": categories or ["doctor_feedback"],
        "priority": priority,
        "summary": summary,
    }


def _sanitize_analysis(data: dict, fallback: dict) -> dict:
    try:
        rating = int(data.get("overall_rating", fallback["overall_rating"]))
        rating = min(5, max(1, rating))
    except (TypeError, ValueError):
        rating = fallback["overall_rating"]
    sentiment = data.get("sentiment", fallback["sentiment"])
    if sentiment not in {"Positive", "Neutral", "Negative"}:
        sentiment = fallback["sentiment"]
    priority = data.get("priority", fallback["priority"])
    if priority not in {"Low", "Medium", "High"}:
        priority = fallback["priority"]
    cats = [c for c in (data.get("categories") or []) if c in VALID_CATEGORIES]
    return {
        "overall_rating": rating,
        "sentiment": sentiment,
        "positive_feedback": [str(x) for x in (data.get("positive_feedback") or [])][:4],
        "issues": [str(x) for x in (data.get("issues") or [])][:4],
        "categories": (cats or fallback["categories"])[:4],
        "priority": priority,
        "summary": str(data.get("summary") or fallback["summary"]),
    }


def analyze_feedback(answers: dict[str, str], language: str) -> dict:
    fallback = _rule_based_analysis(answers)
    if llm_service.llm_available():
        transcript = "\n".join(f"Q ({k}): {v}" for k, v in answers.items() if v)
        messages = [
            {"role": "system", "content": feedback_analysis_prompt(language)},
            {"role": "user", "content": f"Patient feedback answers:\n{transcript}"},
        ]
        data = llm_service.chat_json(messages, temperature=0.2)
        if data:
            return _sanitize_analysis(data, fallback)
    return fallback
