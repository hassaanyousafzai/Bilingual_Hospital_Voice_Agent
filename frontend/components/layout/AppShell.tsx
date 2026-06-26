"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CalendarPlus,
  Database,
  HeartPulse,
  Home,
  PhoneCall,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useUIStore } from "@/store/useUIStore";
import { Badge } from "@/components/ui/Badge";

interface NavItem {
  href: string;
  icon: LucideIcon;
  key: string;
}

const NAV: NavItem[] = [
  { href: "/", icon: Home, key: "nav_home" },
  { href: "/appointment", icon: CalendarPlus, key: "nav_appointment" },
  { href: "/appointments", icon: CalendarCheck, key: "nav_my_appointments" },
  { href: "/doctors", icon: Users, key: "nav_doctors" },
  { href: "/follow-up", icon: PhoneCall, key: "nav_followup" },
  { href: "/insights", icon: BarChart3, key: "nav_insights" },
  { href: "/demo-data", icon: Database, key: "nav_demo" },
];

function LanguageToggle() {
  const { language, setLanguage } = useUIStore();
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {(["en", "ar"] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => setLanguage(lng)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            language === lng ? "bg-white text-brand-700 shadow-soft" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {lng === "en" ? "EN" : "عربي"}
        </button>
      ))}
    </div>
  );
}

function Brand({ language }: { language: "en" | "ar" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
        <HeartPulse className="h-6 w-6" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-ink">{t("appName", language)}</div>
        <div className="text-[11px] text-ink-muted">{t("appTagline", language)}</div>
      </div>
    </div>
  );
}

function NavLinks({ language, onClick }: { language: "en" | "ar"; onClick?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-brand-600 text-white shadow-soft"
                : "text-ink-soft hover:bg-slate-100"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
            <span className="whitespace-nowrap">{t(item.key, language)}</span>
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const language = useUIStore((s) => s.language);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-e border-slate-200/70 bg-white/70 px-5 py-6 backdrop-blur-xl lg:flex">
        <Brand language={language} />
        <nav className="mt-8 flex flex-1 flex-col gap-1.5">
          <NavLinks language={language} />
        </nav>
        <div className="mt-auto space-y-4 border-t border-slate-100 pt-5">
          <LanguageToggle />
          <div className="flex items-center justify-between">
            <Badge tone="amber">{t("demoBadge", language)}</Badge>
            <span className="text-[10px] text-ink-muted">v1.0</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Brand language={language} />
          <LanguageToggle />
        </header>
        <nav className="sticky top-[61px] z-10 flex gap-2 overflow-x-auto border-b border-slate-200/60 bg-white/70 px-4 py-2 backdrop-blur-xl lg:hidden">
          <NavLinks language={language} />
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
