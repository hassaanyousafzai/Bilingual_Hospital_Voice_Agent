export type Language = "en" | "ar";

export interface Department {
  id: number;
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
  accent: string;
}

export interface Slot {
  id: number;
  date: string;
  time: string;
  period: string;
  is_booked: boolean;
}

export interface Doctor {
  id: number;
  name_en: string;
  name_ar: string;
  department_id: number;
  department_key: string;
  department_name_en: string;
  department_name_ar: string;
  photo: string;
  branch_en: string;
  branch_ar: string;
  experience_years: number;
  languages: string[];
  bio_en: string;
  bio_ar: string;
  consultation_duration: number;
  rating: number;
  next_available: Slot | null;
  available_dates: string[];
}

export interface DoctorCreate {
  name_en: string;
  name_ar: string;
  department_key: string;
  branch_en: string;
  branch_ar?: string;
  experience_years: number;
  languages: string[];
  bio_en: string;
  bio_ar?: string;
  consultation_duration: number;
  rating: number;
  work_days: number[];
}

export interface Appointment {
  id: number;
  reference: string;
  doctor_id: number;
  doctor_name_en: string;
  doctor_name_ar: string;
  department_name_en: string;
  department_name_ar: string;
  patient_name: string;
  date: string;
  time: string;
  branch: string;
  status: string;
  language: string;
}

export type AgentPhase =
  | "intake"
  | "recommend"
  | "doctors"
  | "slots"
  | "confirmed"
  | "emergency";

export interface AgentState {
  phase: AgentPhase;
  emergency: boolean;
  department: Department | null;
  doctors: Doctor[];
  slots: Slot[];
  selected_doctor_id: number | null;
  requested_slot: Slot | null;
  nearest_slot: Slot | null;
  appointment: Appointment | null;
}

export interface SessionMessageOut {
  session_id: string;
  reply: string;
  language: Language;
  status: string;
  state: AgentState;
  tools_used: string[];
}

export interface TranscriptLine {
  id: string;
  role: "user" | "agent";
  text: string;
}

// Feedback
export interface MockAppointment {
  id: number;
  reference: string;
  patient_name: string;
  doctor_name_en: string;
  doctor_name_ar: string;
  department: string;
  date: string;
  time: string;
  language: string;
}

export interface FeedbackQuestion {
  key: string;
  order: number;
  text_en: string;
  text_ar: string;
}

export interface FeedbackSessionStart {
  session_id: number;
  patient_name: string;
  doctor_name: string;
  department: string;
  appointment_date: string;
  language: Language;
  greeting: string;
  questions: FeedbackQuestion[];
  first_question: string;
}

export interface FeedbackAnswerOut {
  acknowledgement: string;
  next_question: string | null;
  next_question_key: string | null;
  progress: number;
  total: number;
  done: boolean;
}

export interface FeedbackAnalysis {
  overall_rating: number;
  sentiment: "Positive" | "Neutral" | "Negative";
  positive_feedback: string[];
  issues: string[];
  categories: string[];
  priority: "Low" | "Medium" | "High";
  summary: string;
}

export interface FeedbackComplete {
  session_id: number;
  closing_message: string;
  analysis: FeedbackAnalysis;
}

export interface FeedbackRecord {
  session_id: number;
  patient_name: string;
  doctor_name: string;
  department: string;
  appointment_date: string;
  language: string;
  analysis: FeedbackAnalysis;
  answers: { question: string; answer: string }[];
}

export interface Insights {
  total_feedback_calls: number;
  average_rating: number;
  positive_sentiment_pct: number;
  negative_feedback_count: number;
  most_mentioned_issue: string;
  sentiment_distribution: Record<string, number>;
  rating_distribution: Record<string, number>;
  issue_frequency: { category: string; label: string; count: number }[];
  feedback_trend: { date: string; count: number; avg_rating: number }[];
  doctor_ranking: { doctor: string; avg_rating: number; count: number }[];
}

export interface Scenario {
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  config: Record<string, unknown>;
}

export interface DemoStatus {
  llm_enabled: boolean;
  provider?: string;
  model: string | null;
  counts: {
    doctors: number;
    departments: number;
    appointments: number;
    completed_appointments: number;
    feedback_sessions: number;
  };
}
