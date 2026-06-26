"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Insights, Language } from "@/types";
import { t } from "@/lib/i18n";
import { categoryLabel, sentimentLabel } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#14b8a6",
  Neutral: "#f59e0b",
  Negative: "#f43f5e",
};
const RATING_COLORS = ["#f43f5e", "#fb923c", "#f59e0b", "#84cc16", "#14b8a6"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  fontSize: 12,
};

export function SentimentChart({ data, language }: { data: Insights; language: Language }) {
  const chartData = Object.entries(data.sentiment_distribution).map(([k, v]) => ({
    name: sentimentLabel(k, language),
    raw: k,
    value: v,
  }));
  return (
    <ChartCard title={t("ins_sentiment_dist", language)}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
            {chartData.map((entry) => (
              <Cell key={entry.raw} fill={SENTIMENT_COLORS[entry.raw]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4">
        {chartData.map((e) => (
          <span key={e.raw} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENTIMENT_COLORS[e.raw] }} />
            {e.name} ({e.value})
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function RatingChart({ data, language }: { data: Insights; language: Language }) {
  const chartData = Object.entries(data.rating_distribution).map(([k, v]) => ({ rating: k, count: v }));
  return (
    <ChartCard title={t("ins_rating_dist", language)}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="rating" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={entry.rating} fill={RATING_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function IssueChart({ data, language }: { data: Insights; language: Language }) {
  const chartData = data.issue_frequency
    .slice(0, 6)
    .map((d) => ({ name: categoryLabel(d.category, language), count: d.count }));
  return (
    <ChartCard title={t("ins_issue_freq", language)}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#7c3aed" barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrendChart({ data, language }: { data: Insights; language: Language }) {
  const chartData = data.feedback_trend.map((d) => ({ date: formatDate(d.date, language), rating: d.avg_rating }));
  return (
    <ChartCard title={t("ins_trend", language)}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
          <YAxis domain={[0, 5]} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="rating" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DoctorRankingChart({ data, language }: { data: Insights; language: Language }) {
  const chartData = data.doctor_ranking.slice(0, 6).map((d) => ({
    name: d.doctor.replace(/^Dr\.?\s*/, ""),
    rating: d.avg_rating,
  }));
  return (
    <ChartCard title={t("ins_doctor_rank", language)}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" domain={[0, 5]} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Bar dataKey="rating" radius={[0, 8, 8, 0]} fill="#14b8a6" barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
