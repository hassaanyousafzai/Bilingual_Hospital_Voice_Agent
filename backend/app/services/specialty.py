"""Rule-based symptom understanding: language detection, emergency screening and
specialty recommendation. Used both as a deterministic fallback and to back the
agent's tools so it can never invent a specialty out of thin air."""

from __future__ import annotations

import re

# ── Language detection ───────────────────────────────────────────────────────
_ARABIC_RE = re.compile(r"[؀-ۿ]")


def detect_language(text: str) -> str:
    if not text:
        return "en"
    arabic_chars = len(_ARABIC_RE.findall(text))
    return "ar" if arabic_chars >= 2 else "en"


# ── Emergency screening (never diagnoses, only routes to emergency care) ──────
EMERGENCY_KEYWORDS = [
    # English
    "severe chest pain", "crushing chest", "can't breathe", "cannot breathe",
    "can not breathe", "not breathing", "stopped breathing", "choking",
    "unconscious", "passed out", "fainted", "loss of consciousness",
    "heavy bleeding", "bleeding badly", "won't stop bleeding", "severe bleeding",
    "sudden weakness", "can't speak", "cannot speak", "slurred speech",
    "face drooping", "stroke", "heart attack", "suicidal", "overdose",
    "seizure", "convulsion",
    # Arabic
    "ألم شديد في الصدر", "لا أستطيع التنفس", "صعوبة شديدة في التنفس",
    "فقدان الوعي", "فقدت الوعي", "إغماء", "نزيف حاد", "نزيف شديد",
    "ضعف مفاجئ", "لا أستطيع الكلام", "جلطة", "سكتة", "نوبة قلبية", "تشنج",
]


def is_emergency(text: str) -> bool:
    if not text:
        return False
    low = text.lower()
    return any(kw in low for kw in EMERGENCY_KEYWORDS)


# ── Specialty recommendation ─────────────────────────────────────────────────
SPECIALTY_KEYWORDS: dict[str, list[str]] = {
    "cardiology": [
        "chest", "heart", "palpitation", "palpitations", "blood pressure",
        "hypertension", "cardiac", "chest pain", "chest discomfort", "pulse",
        "قلب", "صدر", "خفقان", "ضغط", "نبض",
    ],
    "pulmonology": [
        "breath", "breathing", "cough", "lung", "lungs", "asthma", "wheez",
        "shortness of breath", "respiratory", "chest infection", "phlegm",
        "تنفس", "سعال", "كحة", "رئة", "ربو", "صدرية", "ضيق نفس",
    ],
    "endocrinology": [
        "diabetes", "blood sugar", "sugar", "thyroid", "hormone", "hormonal",
        "insulin", "weight gain", "weight loss", "metabolism", "glucose",
        "سكري", "سكر", "غدة", "هرمون", "أنسولين", "غدد",
    ],
    "dermatology": [
        "skin", "rash", "acne", "itch", "itching", "eczema", "hair", "nail",
        "pimple", "psoriasis", "dermatitis", "spot", "mole",
        "جلد", "بشرة", "طفح", "حب الشباب", "حكة", "شعر", "أكزيما",
    ],
}

SPECIALTY_FALLBACK = "general"


def recommend_specialty(text: str) -> dict:
    """Return {key, score} for the best-matching specialty (deterministic)."""
    low = (text or "").lower()
    scores: dict[str, int] = {}
    for key, words in SPECIALTY_KEYWORDS.items():
        scores[key] = sum(1 for w in words if w in low)
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return {"key": SPECIALTY_FALLBACK, "score": 0}
    return {"key": best, "score": scores[best]}
