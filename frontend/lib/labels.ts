import type { Language } from "@/types";

const CATEGORY: Record<string, { en: string; ar: string }> = {
  booking_experience: { en: "Booking experience", ar: "تجربة الحجز" },
  waiting_time: { en: "Waiting time", ar: "وقت الانتظار" },
  check_in_process: { en: "Check-in process", ar: "إجراءات الاستقبال" },
  doctor_feedback: { en: "Doctor feedback", ar: "تقييم الطبيب" },
  consultation_quality: { en: "Consultation quality", ar: "جودة الاستشارة" },
  staff_behavior: { en: "Staff behaviour", ar: "سلوك الموظفين" },
  facilities: { en: "Facilities", ar: "المرافق" },
  communication: { en: "Communication", ar: "التواصل" },
};

export function categoryLabel(key: string, lang: Language): string {
  return CATEGORY[key]?.[lang] ?? key;
}

const SENTIMENT: Record<string, { en: string; ar: string }> = {
  Positive: { en: "Positive", ar: "إيجابي" },
  Neutral: { en: "Neutral", ar: "محايد" },
  Negative: { en: "Negative", ar: "سلبي" },
};
export function sentimentLabel(s: string, lang: Language): string {
  return SENTIMENT[s]?.[lang] ?? s;
}

const PRIORITY: Record<string, { en: string; ar: string }> = {
  Low: { en: "Low", ar: "منخفضة" },
  Medium: { en: "Medium", ar: "متوسطة" },
  High: { en: "High", ar: "عالية" },
};
export function priorityLabel(p: string, lang: Language): string {
  return PRIORITY[p]?.[lang] ?? p;
}
