"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Mic, MicOff, PhoneOff, Send } from "lucide-react";
import type { AgentState, Doctor, Language, TranscriptLine } from "@/types";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn, uid, formatDate, formatTime } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { useLiveVoice, type LiveStatus } from "@/hooks/useLiveVoice";
import { VoiceOrb, type OrbStatus } from "@/components/voice/VoiceOrb";
import { Transcript } from "@/components/voice/Transcript";
import { ContextPanel } from "@/components/appointment/ContextPanel";
import { DoctorDrawer } from "@/components/appointment/DoctorDrawer";
import { Button } from "@/components/ui/Button";

const EMPTY_STATE: AgentState = {
  phase: "intake", emergency: false, department: null, doctors: [], slots: [],
  selected_doctor_id: null, requested_slot: null, nearest_slot: null, appointment: null,
};

const END_RE_EN = /\b(bye|good\s?bye|end (the )?call|hang up|that'?s all|that is all|i'?m done|i am done|we'?re done)\b/i;
const END_RE_AR = /(مع السلامة|وداع|إنهاء المكالمة|انهاء المكالمة|انهي المكالمة|أنهي المكالمة|باي|إلى اللقاء)/;
function isEndPhrase(text: string): boolean {
  return END_RE_EN.test(text) || END_RE_AR.test(text);
}

function toOrb(status: LiveStatus, emergency: boolean): OrbStatus {
  if (emergency) return "emergency";
  if (status === "connecting") return "thinking";
  if (status === "speaking") return "speaking";
  if (status === "listening") return "listening";
  return "idle";
}

export default function AppointmentPage() {
  const { language } = useUIStore();
  const live = useLiveVoice();

  const [started, setStarted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>(EMPTY_STATE);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [drawerDoctor, setDrawerDoctor] = useState<Doctor | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const emergencyRef = useRef(false);
  const userBufRef = useRef("");
  const agentBufRef = useRef("");
  const endRequestedRef = useRef(false);
  const endCallRef = useRef<() => void>(() => {});

  const addLine = (role: "user" | "agent", value: string) =>
    setLines((prev) => [...prev, { id: uid(), role, text: value }]);

  const orbStatus = toOrb(live.status, agentState.emergency);

  const startCall = useCallback(async () => {
    setStarted(true);
    setCallEnded(false);
    setAgentState(EMPTY_STATE);
    setLines([]);
    setNotice(null);
    setMuted(false);
    emergencyRef.current = false;
    endRequestedRef.current = false;
    userBufRef.current = "";
    agentBufRef.current = "";
    try {
      await live.connect(language, {
        onState: (s) => {
          setAgentState(s);
          emergencyRef.current = s.emergency;
        },
        onTranscript: (role, chunk) => {
          if (role === "user") userBufRef.current += chunk;
          else agentBufRef.current += chunk;
        },
        onTurnComplete: () => {
          const userText = userBufRef.current.trim();
          if (userText) addLine("user", userText);
          if (agentBufRef.current.trim()) addLine("agent", agentBufRef.current.trim());
          userBufRef.current = "";
          agentBufRef.current = "";
          // Auto hang up if the caller said goodbye / end the call (let the agent's
          // farewell play first).
          if (userText && isEndPhrase(userText) && !endRequestedRef.current) {
            endRequestedRef.current = true;
            window.setTimeout(() => endCallRef.current(), 3500);
          }
        },
        onError: (msg) => {
          if (msg && msg !== "connection_error" && msg !== "error") {
            setNotice(msg);
          } else {
            setNotice(
              language === "ar"
                ? "تعذر الاتصال الصوتي. تأكد من تشغيل الخادم والسماح بالميكروفون."
                : "Voice connection failed. Check the backend is running and mic is allowed."
            );
          }
        },
      });
    } catch {
      setNotice(language === "ar" ? "تم رفض الوصول إلى الميكروفون." : "Microphone access was blocked.");
    }
  }, [language, live]);

  const endCall = useCallback(() => {
    // Flush any partial transcript, then tear everything down (mic included).
    if (userBufRef.current.trim()) addLine("user", userBufRef.current.trim());
    if (agentBufRef.current.trim()) addLine("agent", agentBufRef.current.trim());
    userBufRef.current = "";
    agentBufRef.current = "";
    live.disconnect();
    setStarted(false);
    setCallEnded(true);
  }, [live]);
  endCallRef.current = endCall;

  const newCall = useCallback(async () => {
    setCallEnded(false);
    await startCall();
  }, [startCall]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    live.setMuted(next);
  };

  const onSelectDoctor = (doctor: Doctor) => {
    setDrawerDoctor(doctor);
    setDrawerOpen(true);
  };

  const onConfirmFromDrawer = async (doctor: Doctor, date: string, time: string) => {
    setDrawerOpen(false);
    const name = language === "ar" ? doctor.name_ar : doctor.name_en;
    try {
      const appt = await api.createAppointment({ doctor_id: doctor.id, date, time, language });
      setAgentState((prev) => ({ ...prev, phase: "confirmed", appointment: appt, nearest_slot: null, requested_slot: null }));
      addLine("user", language === "ar"
        ? `حجزت مع ${name} يوم ${formatDate(date, "ar")} الساعة ${formatTime(time, "ar")}.`
        : `Booked ${name} on ${formatDate(date, "en")} at ${formatTime(time, "en")}.`);
      addLine("agent", language === "ar"
        ? `تم تأكيد الموعد. رقم المرجع ${appt.reference}.`
        : `Appointment confirmed. Reference ${appt.reference}.`);
    } catch {
      setNotice(language === "ar" ? "هذا الموعد لم يعد متاحاً." : "That slot is no longer available.");
    }
  };

  const onConfirmProposed = () =>
    live.sendText(language === "ar" ? "نعم، أكد الحجز من فضلك." : "Yes, please confirm the appointment.");

  const submitText = (value: string) => {
    const v = value.trim();
    if (!v) return;
    addLine("user", v);
    live.sendText(v);
    setText("");
    if (isEndPhrase(v) && !endRequestedRef.current) {
      endRequestedRef.current = true;
      window.setTimeout(() => endCallRef.current(), 3500);
    }
  };

  // Only disconnect on unmount (not on every render — the hook returns a new object each render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => live.disconnect(), []);

  const statusLabel =
    orbStatus === "listening" ? t("voice_listening", language)
    : orbStatus === "thinking" ? t("voice_thinking", language)
    : orbStatus === "speaking" ? t("voice_speaking", language)
    : orbStatus === "emergency" ? t("emergency_title", language)
    : muted ? t("voice_resume", language)
    : t("voice_in_call", language);

  // ── Pre-call screen ─────────────────────────────────────────────────────────
  if (!started && !callEnded) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <VoiceOrb status="idle" size={240} />
        </motion.div>
        <h1 className="mt-6 text-2xl font-bold text-ink">{t("nav_appointment", language)}</h1>
        <p className="mt-3 max-w-md text-ink-soft">{t("voice_greeting_hint", language)}</p>
        <p className="mt-1 max-w-md text-sm text-ink-muted">{t("voice_call_hint", language)}</p>
        <Button size="lg" className="mt-7" onClick={startCall}>
          <Mic className="h-5 w-5" /> {t("voice_start_call", language)}
        </Button>
        {notice ? <p className="mt-4 text-sm text-rose-600">{notice}</p> : null}
      </div>
    );
  }

  // ── Call summary (after the call ends) ──────────────────────────────────────
  if (callEnded) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">{t("call_ended_title", language)}</h1>
          <p className="mt-2 text-ink-soft">{t("call_ended_sub", language)}</p>
        </div>
        {agentState.appointment ? (
          <ContextPanel state={agentState} language={language} onSelectDoctor={() => {}} onConfirmProposed={() => {}} onBookAnother={newCall} />
        ) : null}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{t("call_transcript", language)}</h2>
          <div className="max-h-96 overflow-y-auto">
            <Transcript lines={lines} language={language} />
          </div>
        </div>
        <div className="flex justify-center">
          <Button onClick={newCall}><Mic className="h-5 w-5" /> {t("voice_start_call", language)}</Button>
        </div>
      </div>
    );
  }

  // ── Active call ─────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-3">
        <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-medium text-ink-soft">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full",
                  orbStatus === "listening" ? "bg-teal-500" : orbStatus === "thinking" ? "bg-violet-500" : orbStatus === "speaking" ? "bg-brand-500" : orbStatus === "emergency" ? "bg-rose-500" : "bg-slate-400")} />
              </span>
              {statusLabel}
            </div>
            <Button variant="danger" size="sm" onClick={endCall}>
              <PhoneOff className="h-4 w-4" /> {t("voice_end_call", language)}
            </Button>
          </div>

          <div className="flex flex-col items-center py-8">
            <VoiceOrb status={orbStatus} size={220} />
            <button
              onClick={toggleMute}
              className={cn("mt-8 inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-glow transition-all",
                muted ? "bg-slate-400 hover:bg-slate-500" : "bg-brand-600 hover:bg-brand-700")}
              title={muted ? t("voice_resume", language) : t("voice_hold", language)}
            >
              {muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </button>
            <span className="mt-3 text-xs text-ink-muted">
              {muted ? t("voice_on_hold", language) : t("voice_call_hint", language)}
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submitText(text); }} className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("voice_type_here", language)}
              className="h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:bg-white"
            />
            <Button type="submit" size="icon" disabled={!text.trim()}>
              <Send className="h-5 w-5 rtl:-scale-x-100" />
            </Button>
          </form>

          {notice ? <p className="mt-3 text-sm text-rose-600">{notice}</p> : null}

          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-50/70 py-5 text-xs text-ink-muted">
            <Lock className="h-3.5 w-3.5" />
            {t("voice_transcript_after", language)}
          </div>
        </div>
      </section>

      <section className="lg:col-span-2">
        <div className="rounded-3xl border border-slate-100 bg-white/60 p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">{t("panel_title", language)}</h2>
          <AnimatePresence mode="wait">
            <ContextPanel
              key={agentState.phase + (agentState.appointment?.reference ?? "")}
              state={agentState}
              language={language}
              onSelectDoctor={onSelectDoctor}
              onConfirmProposed={onConfirmProposed}
              onBookAnother={newCall}
            />
          </AnimatePresence>
        </div>
      </section>

      <DoctorDrawer
        doctor={drawerDoctor}
        open={drawerOpen}
        language={language}
        requestedSlot={agentState.requested_slot}
        nearestSlot={agentState.nearest_slot}
        onClose={() => setDrawerOpen(false)}
        onConfirm={onConfirmFromDrawer}
      />
    </div>
  );
}
