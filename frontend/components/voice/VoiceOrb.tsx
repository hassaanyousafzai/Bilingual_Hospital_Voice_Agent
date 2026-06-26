"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrbStatus = "idle" | "listening" | "thinking" | "speaking" | "emergency";

const THEME: Record<OrbStatus, { core: string; ring: string; glow: string }> = {
  idle: { core: "from-brand-400 to-brand-600", ring: "rgba(37,99,235,0.35)", glow: "rgba(37,99,235,0.25)" },
  listening: { core: "from-teal-400 to-teal-600", ring: "rgba(20,184,166,0.45)", glow: "rgba(20,184,166,0.3)" },
  thinking: { core: "from-violet-400 to-violet-600", ring: "rgba(124,58,237,0.4)", glow: "rgba(124,58,237,0.28)" },
  speaking: { core: "from-brand-500 to-brand-700", ring: "rgba(37,99,235,0.5)", glow: "rgba(37,99,235,0.35)" },
  emergency: { core: "from-rose-500 to-rose-700", ring: "rgba(225,29,72,0.5)", glow: "rgba(225,29,72,0.35)" },
};

export function VoiceOrb({ status, size = 220 }: { status: OrbStatus; size?: number }) {
  const theme = THEME[status];
  const animated = status === "listening" || status === "speaking";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* Pulsing rings */}
      {animated &&
        [0, 0.7, 1.4].map((delay) => (
          <span
            key={delay}
            className="animate-orb-pulse"
            style={{
              position: "absolute",
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: "9999px",
              border: `2px solid ${theme.ring}`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}

      {/* Soft glow */}
      <div
        className="absolute rounded-full blur-2xl"
        style={{ width: size * 0.85, height: size * 0.85, background: theme.glow }}
      />

      {/* Core */}
      <motion.div
        className={cn("relative grid place-items-center rounded-full bg-gradient-to-br shadow-xl", theme.core)}
        style={{ width: size * 0.62, height: size * 0.62 }}
        animate={
          status === "thinking"
            ? { scale: [1, 1.04, 1] }
            : animated
            ? { scale: [1, 1.06, 1] }
            : { scale: 1 }
        }
        transition={{ duration: status === "speaking" ? 0.8 : 1.6, repeat: animated || status === "thinking" ? Infinity : 0, ease: "easeInOut" }}
      >
        {/* Inner sheen */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-white/30 to-transparent" />

        {status === "emergency" ? (
          <AlertTriangle className="relative h-12 w-12 text-white" />
        ) : status === "speaking" ? (
          <div className="relative flex items-end gap-1.5" style={{ height: size * 0.18 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="eq-bar w-1.5 rounded-full bg-white"
                style={{ animationDelay: `${i * 0.12}s`, height: "40%" }}
              />
            ))}
          </div>
        ) : status === "thinking" ? (
          <div className="relative flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-white"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        ) : (
          <Mic className="relative h-12 w-12 text-white" />
        )}
      </motion.div>
    </div>
  );
}
