"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Stethoscope } from "lucide-react";
import type { FeedbackRecord, Language } from "@/types";
import { t } from "@/lib/i18n";
import { categoryLabel, sentimentLabel } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Stars, sentimentTone } from "@/components/ui/Stars";

export function FeedbackCard({ record, language, index = 0 }: { record: FeedbackRecord; language: Language; index?: number }) {
  const [open, setOpen] = useState(false);
  const a = record.analysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={record.patient_name} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate font-bold text-ink">{record.patient_name}</div>
            <Badge tone={sentimentTone(a.sentiment)}>{sentimentLabel(a.sentiment, language)}</Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <Stethoscope className="h-3.5 w-3.5" /> {record.doctor_name} · {formatDate(record.appointment_date, language)}
          </div>
          <div className="mt-2">
            <Stars value={a.overall_rating} size={15} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{a.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.categories.slice(0, 4).map((c) => (
          <Badge key={c} tone="slate">
            {categoryLabel(c, language)}
          </Badge>
        ))}
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
      >
        {open ? t("ins_collapse", language) : t("ins_expand", language)}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {a.positive_feedback.length ? (
                <div>
                  <div className="text-xs font-semibold text-teal-700">{t("an_positives", language)}</div>
                  <ul className="mt-1 space-y-1">
                    {a.positive_feedback.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs text-ink-soft">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-teal-500" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {a.issues.length ? (
                <div>
                  <div className="text-xs font-semibold text-rose-700">{t("an_issues", language)}</div>
                  <ul className="mt-1 space-y-1">
                    {a.issues.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs text-ink-soft">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-500" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {record.answers.length ? (
                <div className="space-y-1.5">
                  {record.answers.map((qa, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] font-medium text-ink-muted">{qa.question}</div>
                      <div className="text-xs text-ink">{qa.answer}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
