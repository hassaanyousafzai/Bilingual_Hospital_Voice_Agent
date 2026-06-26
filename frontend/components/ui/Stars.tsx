import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn(
            i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
          )}
        />
      ))}
    </div>
  );
}

export function sentimentTone(s: string): "teal" | "amber" | "rose" | "slate" {
  if (s === "Positive") return "teal";
  if (s === "Negative") return "rose";
  if (s === "Neutral") return "amber";
  return "slate";
}

export function priorityTone(p: string): "teal" | "amber" | "rose" {
  if (p === "High") return "rose";
  if (p === "Medium") return "amber";
  return "teal";
}
