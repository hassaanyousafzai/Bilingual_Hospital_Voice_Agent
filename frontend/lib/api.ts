import type {
  Appointment,
  Department,
  Doctor,
  DoctorCreate,
  DemoStatus,
  FeedbackAnswerOut,
  FeedbackComplete,
  FeedbackRecord,
  FeedbackSessionStart,
  Insights,
  Language,
  MockAppointment,
  Scenario,
  SessionMessageOut,
  Slot,
} from "@/types";

// Requests go through the Next.js rewrite proxy → FastAPI. The browser never
// touches the API key.
const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Directory
  departments: () => req<Department[]>("/api/departments"),
  doctors: (specialty?: string) =>
    req<Doctor[]>(`/api/doctors${specialty ? `?specialty=${specialty}` : ""}`),
  doctor: (id: number) => req<Doctor>(`/api/doctors/${id}`),
  createDoctor: (body: DoctorCreate) =>
    req<Doctor>("/api/doctors", { method: "POST", body: JSON.stringify(body) }),
  deleteDoctor: (id: number) =>
    req<{ message: string }>(`/api/doctors/${id}`, { method: "DELETE" }),
  availability: (doctorId: number, date?: string) =>
    req<Slot[]>(`/api/availability?doctor_id=${doctorId}${date ? `&date=${date}` : ""}`),
  appointments: () => req<Appointment[]>("/api/appointments"),
  cancelAppointment: (id: number) =>
    req<{ message: string }>(`/api/appointments/${id}/cancel`, { method: "POST" }),
  createAppointment: (body: {
    doctor_id: number;
    date: string;
    time: string;
    patient_name?: string;
    language?: Language;
  }) => req<Appointment>("/api/appointments", { method: "POST", body: JSON.stringify(body) }),

  // Voice / agent session
  startSession: (language: Language) =>
    req<{ session_id: string; greeting: string; language: Language }>(
      "/api/voice/session/start",
      { method: "POST", body: JSON.stringify({ language }) }
    ),
  sendMessage: (session_id: string, message: string, language?: Language) =>
    req<SessionMessageOut>("/api/voice/session/message", {
      method: "POST",
      body: JSON.stringify({ session_id, message, language }),
    }),
  endSession: (session_id: string) =>
    req("/api/voice/session/end", {
      method: "POST",
      body: JSON.stringify({ session_id, message: "" }),
    }),
  async transcribe(blob: Blob, language?: Language): Promise<{ text: string }> {
    const form = new FormData();
    form.append("audio", blob, "audio.webm");
    if (language) form.append("language", language);
    const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
    if (!res.ok) throw new Error(`transcribe_failed:${res.status}`);
    return res.json();
  },

  // Feedback
  mockAppointments: () => req<MockAppointment[]>("/api/feedback/mock-appointments"),
  startFeedback: (appointment_id: number, language: Language) =>
    req<FeedbackSessionStart>("/api/feedback/session/start", {
      method: "POST",
      body: JSON.stringify({ appointment_id, language }),
    }),
  answerFeedback: (session_id: number, question_key: string, answer_text: string) =>
    req<FeedbackAnswerOut>("/api/feedback/session/answer", {
      method: "POST",
      body: JSON.stringify({ session_id, question_key, answer_text }),
    }),
  completeFeedback: (session_id: number) =>
    req<FeedbackComplete>("/api/feedback/session/complete", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  insights: () => req<Insights>("/api/feedback/insights"),
  records: () => req<FeedbackRecord[]>("/api/feedback/records"),

  ttsStatus: () =>
    req<{ provider: string; ready: boolean; voice: string }>("/api/voice/tts/status"),

  // Demo management
  status: () => req<DemoStatus>("/api/demo/status"),
  scenarios: () => req<Scenario[]>("/api/demo/scenarios"),
  loadScenario: (key: string) =>
    req<{ key: string; flow: string; sample_en: string; sample_ar: string }>(
      "/api/demo/load-scenario",
      { method: "POST", body: JSON.stringify({ key }) }
    ),
  reset: (scope: "all" | "appointments" | "feedback") =>
    req<{ message: string }>("/api/demo/reset", {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),
  seed: () => req<{ message: string }>("/api/demo/seed", { method: "POST" }),
  createMockAppointment: (language: Language) =>
    req<{ message: string }>("/api/demo/mock-appointment", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
};
