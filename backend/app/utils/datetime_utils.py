"""Forgiving normalisation of dates/times the LLM may pass to tools."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def normalize_date(value: str | None) -> str | None:
    """Return an ISO date (YYYY-MM-DD) from common phrasings, or None."""
    if not value:
        return None
    v = value.strip().lower()
    today = date.today()

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return v
    if v in {"today", "اليوم"}:
        return today.isoformat()
    if v in {"tomorrow", "غدا", "غداً", "بكرة"}:
        return (today + timedelta(days=1)).isoformat()
    if v in {"day after tomorrow", "بعد غد", "بعد غدا", "بعد غداً"}:
        return (today + timedelta(days=2)).isoformat()

    for name, idx in _WEEKDAYS.items():
        if name in v:
            ahead = (idx - today.weekday()) % 7
            ahead = ahead or 7
            return (today + timedelta(days=ahead)).isoformat()

    # Try a few date formats
    for fmt in ("%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%B %d", "%d %B"):
        try:
            parsed = datetime.strptime(value.strip(), fmt)
            if parsed.year == 1900:
                parsed = parsed.replace(year=today.year)
            return parsed.date().isoformat()
        except ValueError:
            continue
    return None


def normalize_time(value: str | None) -> str | None:
    """Return 24h HH:MM from phrasings like '3 pm', '10:30 am', '15:00'."""
    if not value:
        return None
    v = value.strip().lower().replace(".", "")

    m = re.fullmatch(r"(\d{1,2}):(\d{2})", v)
    if m:
        h, mm = int(m.group(1)), int(m.group(2))
        return f"{h:02d}:{mm:02d}"

    m = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", v)
    if m:
        h = int(m.group(1))
        mm = int(m.group(2) or 0)
        period = m.group(3)
        if period == "pm" and h != 12:
            h += 12
        if period == "am" and h == 12:
            h = 0
        return f"{h:02d}:{mm:02d}"

    m = re.fullmatch(r"(\d{1,2})", v)
    if m:
        return f"{int(m.group(1)):02d}:00"
    return None


# ── Sentence-level extraction (used by the rule-based fallback agent) ─────────
def extract_date(text: str | None) -> str | None:
    """Find a date anywhere inside a free-text sentence."""
    if not text:
        return None
    low = text.lower()

    iso = re.search(r"\d{4}-\d{2}-\d{2}", low)
    if iso:
        return iso.group(0)
    if "day after tomorrow" in low or "بعد غد" in text:
        return normalize_date("day after tomorrow")
    if "tomorrow" in low or "غدا" in text or "غداً" in text or "بكرة" in text:
        return normalize_date("tomorrow")
    if "today" in low or "اليوم" in text:
        return normalize_date("today")
    for name in _WEEKDAYS:
        if name in low:
            return normalize_date(name)
    return None


def extract_time(text: str | None) -> str | None:
    """Find a time anywhere inside a free-text sentence."""
    if not text:
        return None
    low = text.lower().replace(".", "")

    m = re.search(r"(\d{1,2}:\d{2}\s*(?:am|pm)?)", low)
    if m:
        return normalize_time(m.group(1).strip())
    m = re.search(r"(\d{1,2}\s*(?:am|pm))", low)
    if m:
        return normalize_time(m.group(1).strip())
    m = re.search(r"\bat\s+(\d{1,2})\b", low)
    if m:
        return normalize_time(m.group(1))
    return None
