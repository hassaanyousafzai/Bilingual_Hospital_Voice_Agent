"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarPlus,
  Database,
  Languages,
  Mic,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/utils";

const CARDS = [
  { href: "/appointment", icon: CalendarPlus, title: "home_book_title", desc: "home_book_desc", tone: "from-brand-500 to-brand-700" },
  { href: "/follow-up", icon: PhoneCall, title: "home_followup_title", desc: "home_followup_desc", tone: "from-teal-500 to-teal-600" },
  { href: "/insights", icon: BarChart3, title: "home_insights_title", desc: "home_insights_desc", tone: "from-violet-500 to-violet-700" },
  { href: "/demo-data", icon: Database, title: "home_demo_title", desc: "home_demo_desc", tone: "from-amber-500 to-orange-600" },
] as const;

export default function HomePage() {
  const language = useUIStore((s) => s.language);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white to-brand-50/40 p-8 shadow-card sm:p-12"
      >
        <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-10 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> {t("appName", language)} · {t("demoBadge", language)}
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            {t("home_title", language)}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {t("home_subtitle", language)}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/appointment"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow-soft transition-all hover:bg-brand-700"
            >
              <Mic className="h-5 w-5" />
              {t("voice_start", language)}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link
              href="/insights"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 font-semibold text-ink transition-all hover:border-slate-300"
            >
              <BarChart3 className="h-5 w-5 text-violet-600" />
              {t("nav_insights", language)}
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4 text-brand-600" /> {t("lang_en", language)} · {t("lang_ar", language)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Mic className="h-4 w-4 text-teal-600" /> Voice in & out
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" /> No diagnosis · safety checks
            </span>
          </div>
        </div>
      </motion.section>

      {/* Cards */}
      <section className="grid gap-5 sm:grid-cols-2">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            >
              <Link
                href={card.href}
                className="group flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div>
                  <div
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-soft",
                      card.tone
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{t(card.title, language)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(card.desc, language)}</p>
                </div>
                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  {t("home_open", language)}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}
