"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, Sunrise, Sunset, X } from "lucide-react";
import type { Doctor, Language, Slot } from "@/types";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn, formatTime, relativeDay } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function DoctorDrawer({
  doctor,
  open,
  language,
  requestedSlot,
  nearestSlot,
  onClose,
  onConfirm,
}: {
  doctor: Doctor | null;
  open: boolean;
  language: Language;
  requestedSlot?: Slot | null;
  nearestSlot?: Slot | null;
  onClose: () => void;
  onConfirm: (doctor: Doctor, date: string, time: string) => void;
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; time: string } | null>(null);

  const { data: slots, isLoading } = useQuery({
    queryKey: ["availability", doctor?.id],
    queryFn: () => api.availability(doctor!.id),
    enabled: open && !!doctor,
  });

  const dates = useMemo(() => {
    const set: string[] = [];
    (slots || []).forEach((s) => {
      if (!set.includes(s.date)) set.push(s.date);
    });
    return set;
  }, [slots]);

  useEffect(() => {
    if (!open) return;
    const preferred = nearestSlot?.date || requestedSlot?.date;
    setActiveDate(preferred && dates.includes(preferred) ? preferred : dates[0] ?? null);
    const pre = nearestSlot || requestedSlot;
    if (pre && (slots || []).some((s) => s.date === pre.date && s.time === pre.time)) {
      setSelected({ date: pre.date, time: pre.time });
    } else {
      setSelected(null);
    }
  }, [open, dates, nearestSlot, requestedSlot, slots]);

  const daySlots = (slots || []).filter((s) => s.date === activeDate);
  const morning = daySlots.filter((s) => s.period === "morning");
  const evening = daySlots.filter((s) => s.period === "evening");

  const isHighlighted = (s: Slot, ref?: Slot | null) =>
    !!ref && ref.date === s.date && ref.time === s.time;

  const name = doctor ? (language === "ar" ? doctor.name_ar : doctor.name_en) : "";

  return (
    <AnimatePresence>
      {open && doctor ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: language === "ar" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col bg-canvas shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Avatar name={doctor.name_en} size={52} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("drawer_title", language)}
                  </div>
                  <div className="text-lg font-bold text-ink">{name}</div>
                  <div className="text-xs text-ink-muted">
                    {language === "ar" ? doctor.department_name_ar : doctor.department_name_en}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-ink-muted hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="grid h-40 place-items-center text-ink-muted">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Day tabs */}
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("drawer_pick_day", language)}
                  </div>
                  <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                    {dates.map((d) => (
                      <button
                        key={d}
                        onClick={() => setActiveDate(d)}
                        className={cn(
                          "whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium transition-all",
                          activeDate === d
                            ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                            : "border-slate-200 bg-white text-ink-soft hover:border-slate-300"
                        )}
                      >
                        {relativeDay(d, language)}
                      </button>
                    ))}
                  </div>

                  {/* Slots */}
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("drawer_none", language)}</p>
                  ) : (
                    <div className="space-y-5">
                      {[
                        { label: t("drawer_morning", language), icon: Sunrise, items: morning },
                        { label: t("drawer_evening", language), icon: Sunset, items: evening },
                      ].map(
                        (group) =>
                          group.items.length > 0 && (
                            <div key={group.label}>
                              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                                <group.icon className="h-4 w-4 text-amber-500" /> {group.label}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {group.items.map((s) => {
                                  const isSel = selected?.date === s.date && selected?.time === s.time;
                                  const nearest = isHighlighted(s, nearestSlot) && !isHighlighted(s, requestedSlot);
                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => setSelected({ date: s.date, time: s.time })}
                                      className={cn(
                                        "relative rounded-xl border py-2.5 text-sm font-medium transition-all",
                                        isSel
                                          ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                                          : nearest
                                          ? "border-teal-300 bg-teal-50 text-teal-700"
                                          : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
                                      )}
                                    >
                                      {formatTime(s.time, language)}
                                      {nearest && !isSel ? (
                                        <span className="absolute -top-2 start-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-1.5 py-px text-[9px] font-bold text-white rtl:translate-x-1/2">
                                          {t("nearest_badge", language)}
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-white p-5">
              {selected ? (
                <div className="mb-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                  <span className="text-xs font-semibold text-brand-700">{t("drawer_selected", language)}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-800">
                    <CalendarClock className="h-4 w-4" />
                    {relativeDay(selected.date, language)} · {formatTime(selected.time, language)}
                  </span>
                </div>
              ) : null}
              <Button
                className="w-full"
                size="lg"
                variant="success"
                disabled={!selected}
                onClick={() => selected && onConfirm(doctor, selected.date, selected.time)}
              >
                <Check className="h-5 w-5" /> {t("drawer_confirm", language)}
              </Button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
