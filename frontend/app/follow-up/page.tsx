"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Loader2,
  Lock,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Stethoscope,
  User,
} from "lucide-react";
import type { FeedbackAnalysis, FeedbackQuestion, Language, MockAppointment, TranscriptLine } from "@/types";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn, formatDate, uid } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { useVoice } from "@/hooks/useVoice";
import { VoiceOrb, type OrbStatus } from "@/components/voice/VoiceOrb";
import { Transcript } from "@/components/voice/Transcript";
import { FeedbackResult } from "@/components/feedback/FeedbackResult";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

type Phase = "select" | "calling" | "analyzing" | "result";

export default function FollowUpPage() {
  const { language, voiceEnabled } = useUIStore();
  const voice = useVoice();

  const [phase, setPhase] = useState<Phase>("select");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [meta, setMeta] = useState<{ patient: string; doctor: string; date: string } | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [status, setStatus] = useState<OrbStatus>("idle");
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const sessionRef = useRef<number | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const callActiveRef = useRef(false);
  const mutedRef = useRef(false);
  const turnSentRef = useRef(false);
  const langRef = useRef<Language>(language);
  langRef.current = language;
  const beginRef = useRef<() => void>(() => {});
  const submitRef = useRef<(a: string) => void>(() => {});
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["mock-appointments"],
    queryFn: api.mockAppointments,
  });

  const addLine = (role: "user" | "agent", value: string) =>
    setLines((p) => [...p, { id: uid(), role, text: value }]);

  useEffect(() => {
    if (phase !== "calling") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Call loop ─────────────────────────────────────────────────────────────
  const beginListening = () => {
    if (!callActiveRef.current || mutedRef.current || !voice.sttSupported) return;
    turnSentRef.current = false;
    setStatus("listening");
    voice.startListening(
      langRef.current,
      {
        onFinal: (txt) => {
          turnSentRef.current = true;
          submitRef.current(txt);
        },
        onError: (err) => {
          setStatus("idle");
          if (err === "not-allowed" || err === "service-not-allowed") {
            mutedRef.current = true;
            setMuted(true);
            setNotice(t("voice_mic_denied", langRef.current));
          }
        },
        onEnd: () => {
          if (!turnSentRef.current && callActiveRef.current && !mutedRef.current) {
            window.setTimeout(() => beginRef.current(), 400);
          }
        },
      },
      { continuous: true, silenceMs: 1100 }
    );
  };
  beginRef.current = beginListening;

  const completeCall = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;
    callActiveRef.current = false;
    voice.stopListening();
    voice.cancelSpeak();
    setPhase("analyzing");
    try {
      const res = await api.completeFeedback(sid);
      setAnalysis(res.analysis);
      setPhase("result");
    } catch {
      setNotice(language === "ar" ? "تعذر تحليل الملاحظات." : "Couldn't analyze feedback.");
      setPhase("calling");
    }
  }, [language, voice]);

  const speak = (txt: string, onDone?: () => void) => {
    if (voiceEnabled && voice.ttsSupported) {
      setStatus("speaking");
      voice.speak(txt, langRef.current, {
        onEnd: () => {
          setStatus("idle");
          onDone?.();
        },
        onBargeIn: () => {
          setStatus("idle");
          if (callActiveRef.current && !mutedRef.current) beginRef.current();
        },
      });
    } else {
      setStatus("idle");
      onDone?.();
    }
  };

  const submitAnswer = async (answer: string) => {
    const sid = sessionRef.current;
    const key = currentKeyRef.current;
    if (!sid || !key || !answer.trim()) return;
    voice.stopListening();
    addLine("user", answer);
    setStatus("thinking");
    try {
      const res = await api.answerFeedback(sid, key, answer);
      addLine("agent", res.acknowledgement);
      setProgress(res.progress);
      if (res.done) {
        currentKeyRef.current = null;
        setCurrentKey(null);
        speak(res.acknowledgement, () => completeCall());
      } else {
        currentKeyRef.current = res.next_question_key;
        setCurrentKey(res.next_question_key);
        speak(res.acknowledgement, () => {
          if (callActiveRef.current && !mutedRef.current) beginRef.current();
        });
      }
    } catch {
      setStatus("idle");
      if (callActiveRef.current && !mutedRef.current) beginRef.current();
    }
  };
  submitRef.current = submitAnswer;

  const startCall = async (appt: MockAppointment) => {
    try {
      await voice.primeAudio(); // unlock audio + mic for playback and barge-in
      const res = await api.startFeedback(appt.id, langRef.current);
      sessionRef.current = res.session_id;
      setSessionId(res.session_id);
      setMeta({ patient: res.patient_name, doctor: res.doctor_name, date: res.appointment_date });
      setQuestions(res.questions);
      currentKeyRef.current = res.questions[0]?.key ?? null;
      setCurrentKey(res.questions[0]?.key ?? null);
      setProgress(0);
      setLines([]);
      setSeconds(0);
      setAnalysis(null);
      setMuted(false);
      mutedRef.current = false;
      callActiveRef.current = true;
      setPhase("calling");
      addLine("agent", res.greeting);
      speak(res.greeting, () => {
        if (callActiveRef.current && !mutedRef.current) beginRef.current();
      });
    } catch {
      setNotice(language === "ar" ? "تعذر بدء المكالمة." : "Couldn't start the call.");
    }
  };

  // ── Mic ───────────────────────────────────────────────────────────────────
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        setStatus("thinking");
        try {
          const { text: txt } = await api.transcribe(new Blob(chunksRef.current, { type: "audio/webm" }), langRef.current);
          if (txt) await submitAnswer(txt);
          else setStatus("idle");
        } catch {
          setStatus("idle");
          setNotice(t("voice_no_speech", langRef.current));
        }
      };
      mr.start();
      mrRef.current = mr;
      setStatus("listening");
    } catch {
      setNotice(t("voice_mic_denied", langRef.current));
    }
  };

  const toggleMic = () => {
    setNotice(null);
    if (!voice.sttSupported) {
      if (status === "listening") mrRef.current?.stop();
      else startMediaRecorder();
      return;
    }
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      voice.stopListening();
      voice.cancelSpeak();
      setStatus("idle");
    } else {
      beginListening();
    }
  };

  const reset = () => {
    callActiveRef.current = false;
    voice.cancelSpeak();
    voice.stopListening();
    sessionRef.current = null;
    setPhase("select");
    setAnalysis(null);
    setLines([]);
    setMuted(false);
    mutedRef.current = false;
    refetch();
  };

  useEffect(() => {
    return () => {
      callActiveRef.current = false;
      voice.cancelSpeak();
      voice.stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const total = questions.length || 5;
  const currentQuestionNo = Math.min(progress + 1, total);

  // ── Select screen ─────────────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("fu_title", language)}</h1>
          <p className="mt-2 text-ink-soft">{t("fu_subtitle", language)}</p>
        </div>
        {isLoading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        ) : !appointments?.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-ink-muted">
            {t("fu_no_appts", language)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {appointments.map((appt, i) => (
              <motion.button
                key={appt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => startCall(appt)}
                className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-start shadow-soft transition-all hover:border-brand-200 hover:shadow-card"
              >
                <Avatar name={appt.patient_name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-ink">{appt.patient_name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-muted">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {language === "ar" ? appt.doctor_name_ar : appt.doctor_name_en} · {appt.department}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(appt.date, language)}
                  </div>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-500 group-hover:text-white">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
        {notice ? <p className="text-sm text-rose-600">{notice}</p> : null}
      </div>
    );
  }

  if (phase === "result" && analysis) {
    return (
      <div className="space-y-6">
        <FeedbackResult analysis={analysis} language={language} onRestart={reset} />
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {t("call_transcript", language)}
          </h2>
          <div className="max-h-96 overflow-y-auto">
            <Transcript lines={lines} language={language} />
          </div>
        </div>
      </div>
    );
  }

  // ── Call screen ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card">
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-ink to-slate-800 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
            </span>
            <span className="text-sm font-medium">{t("fu_in_call", language)}</span>
          </div>
          <div className="font-mono text-sm tabular-nums">{mmss}</div>
        </div>

        {meta ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 px-6 py-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <User className="h-4 w-4 text-brand-500" />
              <span className="font-semibold text-ink">{meta.patient}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Stethoscope className="h-4 w-4 text-teal-500" /> {meta.doctor}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <CalendarDays className="h-4 w-4" /> {t("fu_visited", language)} {formatDate(meta.date, language)}
            </span>
          </div>
        ) : null}

        <div className="p-6">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-medium text-ink-muted">
            {t("fu_question", language)} {currentQuestionNo} {t("fu_of", language)} {total}
          </div>
          <div className="mx-auto mb-6 flex max-w-xs items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < progress ? "bg-teal-500" : i === progress ? "bg-brand-500" : "bg-slate-200"
                )}
              />
            ))}
          </div>

          <div className="flex flex-col items-center pb-6">
            {phase === "analyzing" ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                <p className="mt-4 text-sm text-ink-muted">{t("fu_analyzing", language)}</p>
              </div>
            ) : (
              <>
                <VoiceOrb status={status} size={170} />
                <button
                  onClick={toggleMic}
                  className={cn(
                    "mt-6 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-glow transition-all",
                    muted ? "bg-slate-400 hover:bg-slate-500" : "bg-brand-600 hover:bg-brand-700"
                  )}
                  title={muted ? t("voice_resume", language) : t("voice_hold", language)}
                >
                  {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <span className="mt-2 text-xs text-ink-muted">
                  {muted ? t("voice_on_hold", language) : voice.sttSupported ? t("voice_hold", language) : t("voice_record", language)}
                </span>
              </>
            )}
          </div>

          {phase === "calling" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) {
                  submitAnswer(text.trim());
                  setText("");
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("fu_answer_placeholder", language)}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-400 focus:bg-white"
              />
              <Button type="submit" size="icon" disabled={!text.trim()}>
                <Send className="h-5 w-5 rtl:-scale-x-100" />
              </Button>
            </form>
          ) : null}

          {notice ? <p className="mt-3 text-center text-sm text-rose-600">{notice}</p> : null}

          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-50/70 py-4 text-xs text-ink-muted">
            <Lock className="h-3.5 w-3.5" />
            {t("voice_transcript_after", language)}
          </div>

          <div className="mt-5 flex justify-center">
            <Button variant="danger" onClick={completeCall} disabled={phase === "analyzing"}>
              <PhoneOff className="h-4 w-4" /> {t("fu_end_call", language)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
