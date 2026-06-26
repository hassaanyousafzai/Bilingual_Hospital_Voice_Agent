import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string, lang: "en" | "ar" = "en"): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  if (lang === "ar") {
    return `${DAYS_AR[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  }
  return `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
}

export function formatTime(time: string, lang: "en" | "ar" = "en"): string {
  if (!time) return "";
  const [hStr, m] = time.split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? (lang === "ar" ? "مساءً" : "PM") : lang === "ar" ? "صباحاً" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

export function relativeDay(iso: string, lang: "en" | "ar" = "en"): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return lang === "ar" ? "اليوم" : "Today";
  if (diff === 1) return lang === "ar" ? "غداً" : "Tomorrow";
  return formatDate(iso, lang);
}

export function initials(name: string): string {
  const clean = name.replace(/^Dr\.?\s*/i, "").replace(/^د\.?\s*/, "").trim();
  const parts = clean.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
