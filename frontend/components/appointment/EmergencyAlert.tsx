"use client";

import { motion } from "framer-motion";
import { AlertTriangle, PhoneCall } from "lucide-react";
import type { Language } from "@/types";
import { t } from "@/lib/i18n";

export function EmergencyAlert({ language }: { language: Language }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-6"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-rose-800">{t("emergency_title", language)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-rose-700">{t("emergency_body", language)}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
            <PhoneCall className="h-4 w-4" /> 997 / 911
          </div>
        </div>
      </div>
    </motion.div>
  );
}
