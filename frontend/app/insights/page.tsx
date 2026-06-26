"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MessageSquareText, Smile, Star, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useUIStore } from "@/store/useUIStore";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  DoctorRankingChart,
  IssueChart,
  RatingChart,
  SentimentChart,
  TrendChart,
} from "@/components/dashboard/Charts";
import { FeedbackCard } from "@/components/dashboard/FeedbackCard";

export default function InsightsPage() {
  const { language } = useUIStore();
  const insights = useQuery({ queryKey: ["insights"], queryFn: api.insights });
  const records = useQuery({ queryKey: ["records"], queryFn: api.records });

  if (insights.isLoading) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
      </div>
    );
  }

  const data = insights.data;
  if (!data || data.total_feedback_calls === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("ins_title", language)}</h1>
          <p className="mt-2 text-ink-soft">{t("ins_subtitle", language)}</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-12 text-center text-ink-muted">
          {t("ins_empty", language)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("ins_title", language)}</h1>
        <p className="mt-2 text-ink-soft">{t("ins_subtitle", language)}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard index={0} label={t("ins_total", language)} value={data.total_feedback_calls} icon={MessageSquareText} tone="brand" />
        <MetricCard index={1} label={t("ins_avg", language)} value={`${data.average_rating} / 5`} icon={Star} tone="amber" />
        <MetricCard index={2} label={t("ins_positive", language)} value={`${data.positive_sentiment_pct}%`} icon={Smile} tone="teal" />
        <MetricCard index={3} label={t("ins_negative", language)} value={data.negative_feedback_count} icon={AlertTriangle} tone="rose" />
        <MetricCard index={4} label={t("ins_top_issue", language)} value={data.most_mentioned_issue} icon={TrendingUp} tone="violet" />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SentimentChart data={data} language={language} />
        <RatingChart data={data} language={language} />
        <IssueChart data={data} language={language} />
        <DoctorRankingChart data={data} language={language} />
      </div>
      <TrendChart data={data} language={language} />

      {/* Records */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-ink">{t("ins_recent", language)}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.data?.map((r, i) => (
            <FeedbackCard key={r.session_id} record={r} language={language} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
