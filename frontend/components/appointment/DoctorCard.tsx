"use client";

import { motion } from "framer-motion";
import { Building2, CalendarClock, Languages, Star } from "lucide-react";
import type { Doctor, Language } from "@/types";
import { t } from "@/lib/i18n";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatTime, relativeDay } from "@/lib/utils";

export function DoctorCard({
  doctor,
  language,
  onSelect,
  index = 0,
}: {
  doctor: Doctor;
  language: Language;
  onSelect: (doctor: Doctor) => void;
  index?: number;
}) {
  const name = language === "ar" ? doctor.name_ar : doctor.name_en;
  const branch = language === "ar" ? doctor.branch_ar : doctor.branch_en;
  const na = doctor.next_available;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-soft transition-all hover:border-brand-200 hover:shadow-card"
    >
      <div className="flex gap-3.5">
        <Avatar name={doctor.name_en} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[15px] font-bold text-ink">{name}</div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {doctor.rating.toFixed(1)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {branch}
            </span>
            <span>· {doctor.experience_years} {t("doc_experience", language)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
            <Languages className="h-3.5 w-3.5" />
            {doctor.languages.join(language === "ar" ? "، " : ", ")}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        {na ? (
          <Badge tone="teal">
            <CalendarClock className="h-3.5 w-3.5" />
            {t("doc_next", language)}: {relativeDay(na.date, language)} · {formatTime(na.time, language)}
          </Badge>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
        <Button size="sm" onClick={() => onSelect(doctor)}>
          {t("doc_select", language)}
        </Button>
      </div>
    </motion.div>
  );
}
