"use client";

import { motion } from "framer-motion";
import { CalendarCheck2, CalendarClock, Check, Stethoscope } from "lucide-react";
import type { AgentState, Doctor, Language } from "@/types";
import { t } from "@/lib/i18n";
import { formatTime, relativeDay } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DepartmentBlock } from "./DepartmentBlock";
import { DoctorCard } from "./DoctorCard";
import { ConfirmationCard } from "./ConfirmationCard";
import { EmergencyAlert } from "./EmergencyAlert";

function ProposedSlot({
  state,
  doctor,
  language,
  onConfirm,
  onOpenDrawer,
}: {
  state: AgentState;
  doctor: Doctor | null;
  language: Language;
  onConfirm: () => void;
  onOpenDrawer: () => void;
}) {
  const nearest = state.nearest_slot;
  const requested = state.requested_slot;
  if (!nearest && !requested) return null;
  const unavailable = requested && nearest && (requested.date !== nearest.date || requested.time !== nearest.time);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t("panel_slots", language)}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
        {doctor ? (
          <div className="mb-3 text-sm font-bold text-ink">
            {language === "ar" ? doctor.name_ar : doctor.name_en}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {unavailable && requested ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm text-ink-muted line-through">
              {relativeDay(requested.date, language)} · {formatTime(requested.time, language)}
            </span>
          ) : null}
          {nearest ? (
            <span className="relative inline-flex items-center gap-1.5 rounded-xl border-2 border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
              <CalendarClock className="h-4 w-4" />
              {relativeDay(nearest.date, language)} · {formatTime(nearest.time, language)}
              <Badge tone="teal" className="ms-1">{unavailable ? t("nearest_badge", language) : t("requested_badge", language)}</Badge>
            </span>
          ) : null}
        </div>
        <div className="mt-3.5 flex gap-2">
          <Button size="sm" variant="success" onClick={onConfirm} className="flex-1">
            <Check className="h-4 w-4" /> {t("drawer_confirm", language)}
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenDrawer}>
            {t("doc_view", language)}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function ContextPanel({
  state,
  language,
  onSelectDoctor,
  onConfirmProposed,
  onBookAnother,
}: {
  state: AgentState;
  language: Language;
  onSelectDoctor: (doctor: Doctor) => void;
  onConfirmProposed: () => void;
  onBookAnother: () => void;
}) {
  if (state.emergency) return <EmergencyAlert language={language} />;
  if (state.appointment)
    return <ConfirmationCard appt={state.appointment} language={language} onBookAnother={onBookAnother} />;

  const hasContent = state.department || state.doctors.length > 0 || state.nearest_slot;
  const selectedDoctor =
    state.doctors.find((d) => d.id === state.selected_doctor_id) ?? state.doctors[0] ?? null;

  if (!hasContent) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Stethoscope className="h-7 w-7" />
        </div>
        <p className="mt-4 max-w-xs text-sm text-ink-muted">{t("panel_empty", language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.department ? <DepartmentBlock dept={state.department} language={language} /> : null}

      {state.nearest_slot ? (
        <ProposedSlot
          state={state}
          doctor={selectedDoctor}
          language={language}
          onConfirm={onConfirmProposed}
          onOpenDrawer={() => selectedDoctor && onSelectDoctor(selectedDoctor)}
        />
      ) : null}

      {state.doctors.length > 0 && !state.nearest_slot ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <CalendarCheck2 className="h-4 w-4" /> {t("panel_doctors", language)}
          </div>
          <div className="space-y-3">
            {state.doctors.map((d, i) => (
              <DoctorCard key={d.id} doctor={d} language={language} index={i} onSelect={onSelectDoctor} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
