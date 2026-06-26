"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import type { Department, Language } from "@/types";
import { t } from "@/lib/i18n";
import { DeptIcon } from "@/components/ui/DeptIcon";

export function DepartmentBlock({ dept, language }: { dept: Department; language: Language }) {
  const name = language === "ar" ? dept.name_ar : dept.name_en;
  const desc = language === "ar" ? dept.description_ar : dept.description_en;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t("panel_suggested_dept", language)}
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
        <div
          className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-soft"
          style={{ background: `linear-gradient(135deg, ${dept.accent}, ${dept.accent}cc)` }}
        >
          <DeptIcon icon={dept.icon} className="h-7 w-7" />
        </div>
        <div>
          <div className="text-lg font-bold text-ink">{name}</div>
          <div className="text-sm text-ink-muted">{desc}</div>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {t("panel_recommendation_note", language)}
      </div>
    </motion.div>
  );
}
