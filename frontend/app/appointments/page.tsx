"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, CalendarClock, Hash, Loader2, Stethoscope, Trash2 } from "lucide-react";
import type { Appointment } from "@/types";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function AppointmentsPage() {
  const { language } = useUIStore();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["appointments"], queryFn: api.appointments });

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.cancelAppointment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const onCancel = (a: Appointment) => {
    if (window.confirm(t("appts_cancel_confirm", language))) cancelMut.mutate(a.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("appts_title", language)}</h1>
        <p className="mt-2 text-ink-soft">{t("appts_subtitle", language)}</p>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-12 text-center text-ink-muted">
          {t("appts_empty", language)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((a, i) => {
            const docName = language === "ar" ? a.doctor_name_ar : a.doctor_name_en;
            const deptName = language === "ar" ? a.department_name_ar : a.department_name_en;
            const cancelled = a.status === "cancelled";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
              >
                <div className="flex items-start gap-3.5">
                  <Avatar name={a.doctor_name_en} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{docName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                      <Stethoscope className="h-3.5 w-3.5" /> {deptName}
                    </div>
                  </div>
                  <Badge tone={cancelled ? "rose" : "teal"}>
                    {cancelled ? t("appts_cancelled", language) : t("appts_confirmed", language)}
                  </Badge>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-ink-soft">
                    <CalendarClock className="h-4 w-4 text-brand-500" />
                    {formatDate(a.date, language)} · {formatTime(a.time, language)}
                  </div>
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Building2 className="h-4 w-4" /> {a.branch}
                  </div>
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Hash className="h-4 w-4" />
                    <span className="font-mono font-semibold text-ink">{a.reference}</span>
                  </div>
                </dl>

                {!cancelled ? (
                  <div className="mt-4">
                    <Button variant="outline" size="sm" className="w-full" disabled={cancelMut.isPending} onClick={() => onCancel(a)}>
                      <Trash2 className="h-4 w-4" /> {t("appts_cancel", language)}
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
