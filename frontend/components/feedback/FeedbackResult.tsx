"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, RotateCcw, Tag } from "lucide-react";
import type { FeedbackAnalysis, Language } from "@/types";
import { t } from "@/lib/i18n";
import { categoryLabel, priorityLabel, sentimentLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stars, priorityTone, sentimentTone } from "@/components/ui/Stars";

export function FeedbackResult({
  analysis,
  language,
  onRestart,
}: {
  analysis: FeedbackAnalysis;
  language: Language;
  onRestart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl space-y-5"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-ink">{t("fu_results", language)}</h2>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-soft">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("an_rating", language)}</div>
          <div className="mt-2 text-3xl font-bold text-ink">{analysis.overall_rating}.0</div>
          <div className="mt-1.5 flex justify-center">
            <Stars value={analysis.overall_rating} size={14} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-soft">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("an_sentiment", language)}</div>
          <div className="mt-3 flex justify-center">
            <Badge tone={sentimentTone(analysis.sentiment)} className="text-sm">
              {sentimentLabel(analysis.sentiment, language)}
            </Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-soft">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("an_priority", language)}</div>
          <div className="mt-3 flex justify-center">
            <Badge tone={priorityTone(analysis.priority)} className="text-sm">
              {priorityLabel(analysis.priority, language)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("an_summary", language)}</div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{analysis.summary}</p>
      </div>

      {/* Positives & issues */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-700">
            <CheckCircle2 className="h-4 w-4" /> {t("an_positives", language)}
          </div>
          <ul className="mt-3 space-y-2">
            {analysis.positive_feedback.length ? (
              analysis.positive_feedback.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  {p}
                </li>
              ))
            ) : (
              <li className="text-sm text-ink-muted">{t("an_none", language)}</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4" /> {t("an_issues", language)}
          </div>
          <ul className="mt-3 space-y-2">
            {analysis.issues.length ? (
              analysis.issues.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  {p}
                </li>
              ))
            ) : (
              <li className="text-sm text-ink-muted">{t("an_none", language)}</li>
            )}
          </ul>
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <Tag className="h-4 w-4" /> {t("an_categories", language)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {analysis.categories.map((c) => (
            <Badge key={c} tone="violet">
              {categoryLabel(c, language)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="h-4 w-4 rtl:-scale-x-100" /> {t("fu_new_call", language)}
        </Button>
      </div>
    </motion.div>
  );
}
