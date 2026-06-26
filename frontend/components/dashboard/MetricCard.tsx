"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  sub,
  index = 0,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "brand" | "teal" | "rose" | "amber" | "violet";
  sub?: string;
  index?: number;
}) {
  const tones = {
    brand: "from-brand-500 to-brand-700",
    teal: "from-teal-500 to-teal-600",
    rose: "from-rose-500 to-rose-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-violet-700",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
    >
      <div className="flex items-start justify-between">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-soft", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-xs font-medium text-ink-muted">{label}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-muted/80">{sub}</div> : null}
    </motion.div>
  );
}
