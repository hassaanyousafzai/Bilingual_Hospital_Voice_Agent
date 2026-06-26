import { cn } from "@/lib/utils";

type Tone = "brand" | "teal" | "amber" | "rose" | "slate" | "violet";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn("chip", tones[tone], className)}>{children}</span>;
}
