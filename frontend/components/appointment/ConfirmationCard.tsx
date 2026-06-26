"use client";

import { motion } from "framer-motion";
import { CalendarPlus, CheckCircle2, Download, RotateCcw } from "lucide-react";
import type { Appointment, Language } from "@/types";
import { t } from "@/lib/i18n";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatDate, formatTime } from "@/lib/utils";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildICS(appt: Appointment) {
  const [h, m] = appt.time.split(":");
  const start = `${appt.date.replace(/-/g, "")}T${h}${m}00`;
  const endH = String((parseInt(h, 10) + 0) % 24).padStart(2, "0");
  const endM = String((parseInt(m, 10) + 30) % 60).padStart(2, "0");
  const end = `${appt.date.replace(/-/g, "")}T${endH}${endM}00`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shifa Health//Demo//EN",
    "BEGIN:VEVENT",
    `UID:${appt.reference}@shifa.demo`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Appointment with ${appt.doctor_name_en} (${appt.department_name_en})`,
    `LOCATION:${appt.branch}`,
    `DESCRIPTION:Reference ${appt.reference}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function ConfirmationCard({
  appt,
  language,
  onBookAnother,
}: {
  appt: Appointment;
  language: Language;
  onBookAnother: () => void;
}) {
  const docName = language === "ar" ? appt.doctor_name_ar : appt.doctor_name_en;
  const deptName = language === "ar" ? appt.department_name_ar : appt.department_name_en;

  const rows = [
    { label: t("conf_doctor", language), value: docName },
    { label: t("conf_dept", language), value: deptName },
    {
      label: t("conf_datetime", language),
      value: `${formatDate(appt.date, language)} · ${formatTime(appt.time, language)}`,
    },
    { label: t("conf_branch", language), value: appt.branch },
  ];

  const onDownload = () => {
    const text = [
      "Shifa Health — Appointment Confirmation",
      "----------------------------------------",
      `${t("conf_ref", language)}: ${appt.reference}`,
      `${t("conf_doctor", language)}: ${docName}`,
      `${t("conf_dept", language)}: ${deptName}`,
      `${t("conf_datetime", language)}: ${formatDate(appt.date, "en")} ${formatTime(appt.time, "en")}`,
      `${t("conf_branch", language)}: ${appt.branch}`,
      `${t("fu_patient", language)}: ${appt.patient_name}`,
    ].join("\n");
    download(`${appt.reference}.txt`, text, "text/plain");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-card"
    >
      <div className="flex flex-col items-center bg-gradient-to-br from-teal-50 to-white px-6 py-7 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="grid h-16 w-16 place-items-center rounded-full bg-teal-500 text-white shadow-glow"
        >
          <CheckCircle2 className="h-9 w-9" />
        </motion.div>
        <h3 className="mt-4 text-xl font-bold text-ink">{t("conf_title", language)}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("conf_subtitle", language)}</p>
      </div>

      <div className="px-6 pb-2">
        <div className="-mt-3 mb-4 flex items-center justify-center">
          <span className="rounded-full bg-ink px-4 py-1.5 font-mono text-sm font-semibold text-white">
            {appt.reference}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <Avatar name={appt.doctor_name_en} size={48} />
          <div>
            <div className="font-bold text-ink">{docName}</div>
            <div className="text-xs text-ink-muted">{deptName}</div>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{r.label}</dt>
              <dd className="text-end text-sm font-semibold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2.5 p-6 pt-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => download(`${appt.reference}.ics`, buildICS(appt), "text/calendar")}>
            <CalendarPlus className="h-4 w-4" /> {t("conf_add_calendar", language)}
          </Button>
          <Button variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4" /> {t("conf_download", language)}
          </Button>
        </div>
        <Button className="w-full" onClick={onBookAnother}>
          <RotateCcw className="h-4 w-4 rtl:-scale-x-100" /> {t("conf_book_another", language)}
        </Button>
      </div>
    </motion.div>
  );
}
