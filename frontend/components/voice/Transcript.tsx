"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HeartPulse, User } from "lucide-react";
import type { Language, TranscriptLine } from "@/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Transcript({
  lines,
  interim,
  language,
}: {
  lines: TranscriptLine[];
  interim?: string;
  language: Language;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, interim]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        {t("voice_transcript", language)}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pe-1">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2.5", line.role === "user" && "flex-row-reverse")}
            >
              <div
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                  line.role === "agent" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500"
                )}
              >
                {line.role === "agent" ? <HeartPulse className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  line.role === "agent"
                    ? "bg-white text-ink shadow-soft"
                    : "bg-brand-600 text-white"
                )}
              >
                {line.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {interim ? (
          <div className="flex flex-row-reverse gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <div className="max-w-[82%] rounded-2xl bg-brand-500/70 px-3.5 py-2.5 text-sm italic text-white">
              {interim}…
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
