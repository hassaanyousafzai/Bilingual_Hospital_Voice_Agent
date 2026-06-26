"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  CheckCircle2,
  CircleDot,
  Database,
  Loader2,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import type { Language } from "@/types";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { useVoice } from "@/hooks/useVoice";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function DemoDataPage() {
  const { language, setLanguage, setScenarioSample } = useUIStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const voice = useVoice();
  const status = useQuery({ queryKey: ["demo-status"], queryFn: api.status });
  const scenarios = useQuery({ queryKey: ["scenarios"], queryFn: api.scenarios });
  const ttsStatus = useQuery({ queryKey: ["tts-status"], queryFn: api.ttsStatus });

  const invalidateAll = () => {
    ["insights", "records", "mock-appointments", "demo-status"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  };

  const run = async (id: string, fn: () => Promise<{ message: string }>) => {
    setBusy(id);
    setMessage(null);
    try {
      const res = await fn();
      setMessage(res.message);
      invalidateAll();
    } catch {
      setMessage(language === "ar" ? "حدث خطأ. تأكد من تشغيل الخادم." : "Something went wrong. Is the backend running?");
    } finally {
      setBusy(null);
    }
  };

  const loadScenario = async (key: string) => {
    setBusy(key);
    try {
      const res = await api.loadScenario(key);
      if (res.flow === "feedback") {
        router.push("/follow-up");
      } else {
        setScenarioSample(language === "ar" ? res.sample_ar : res.sample_en);
        router.push("/appointment");
      }
    } catch {
      setMessage(language === "ar" ? "تعذر تحميل السيناريو." : "Couldn't load scenario.");
    } finally {
      setBusy(null);
    }
  };

  const counts = status.data?.counts;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("demo_title", language)}</h1>
        <p className="mt-2 text-ink-soft">{t("demo_subtitle", language)}</p>
      </div>

      {/* Status */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{t("demo_status", language)}</div>
              {status.data ? (
                <Badge tone={status.data.llm_enabled ? "teal" : "amber"} className="mt-1">
                  <CircleDot className="h-3.5 w-3.5" />
                  {status.data.llm_enabled
                    ? `${t("demo_ai_on", language)}${status.data.model ? ` · ${status.data.model}` : ""}`
                    : t("demo_ai_off", language)}
                </Badge>
              ) : (
                <Loader2 className="mt-1 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
          {counts ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
              <span>{counts.doctors} doctors</span>
              <span>{counts.appointments} appointments</span>
              <span>{counts.completed_appointments} completed</span>
              <span>{counts.feedback_sessions} feedback</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Voice engine */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{t("demo_voice", language)}</div>
              {ttsStatus.data ? (
                <Badge tone={ttsStatus.data.provider !== "browser" && ttsStatus.data.ready ? "teal" : "amber"} className="mt-1">
                  <CircleDot className="h-3.5 w-3.5" />
                  {ttsStatus.data.provider !== "browser" && ttsStatus.data.ready
                    ? `${t("demo_voice_ready", language)} · ${ttsStatus.data.provider} (${ttsStatus.data.voice})`
                    : t("demo_voice_browser", language)}
                </Badge>
              ) : (
                <Loader2 className="mt-1 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => voice.speak(t("demo_voice_sample", language), language)}
          >
            <PlayCircle className="h-4 w-4" /> {t("demo_voice_test", language)}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t("demo_voice_hint", language)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{t("demo_actions", language)}</h2>

          {/* Patient language */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
            <div className="mb-2.5 text-sm font-medium text-ink">{t("demo_lang", language)}</div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(["en", "ar"] as Language[]).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setLanguage(lng)}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                    language === lng ? "bg-white text-brand-700 shadow-soft" : "text-slate-500"
                  )}
                >
                  {lng === "en" ? t("lang_en", language) : t("lang_ar", language)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5">
            <Button variant="success" disabled={!!busy} onClick={() => run("mock", () => api.createMockAppointment(language))}>
              {busy === "mock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {t("demo_create_mock", language)}
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => run("seed", () => api.seed())}>
              {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("demo_seed", language)}
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" disabled={!!busy} onClick={() => run("ra", () => api.reset("appointments"))}>
                <Trash2 className="h-4 w-4" /> {t("demo_reset_appts", language)}
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("rf", () => api.reset("feedback"))}>
                <Trash2 className="h-4 w-4" /> {t("demo_reset_feedback", language)}
              </Button>
            </div>
            <Button variant="danger" disabled={!!busy} onClick={() => run("all", () => api.reset("all"))}>
              {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("demo_reset_all", language)}
            </Button>
          </div>

          {message ? (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
              <CheckCircle2 className="h-4 w-4" /> {message}
            </div>
          ) : null}
        </div>

        {/* Scenarios */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{t("demo_scenarios", language)}</h2>
          <div className="space-y-2.5">
            {scenarios.data?.map((s) => (
              <div key={s.key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {language === "ar" ? s.name_ar : s.name_en}
                  </div>
                  <div className="truncate text-xs text-ink-muted">
                    {language === "ar" ? s.description_ar : s.description_en}
                  </div>
                </div>
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => loadScenario(s.key)}>
                  {busy === s.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  {t("demo_load", language)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
