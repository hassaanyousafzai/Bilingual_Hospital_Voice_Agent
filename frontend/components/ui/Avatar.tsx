import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

const GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-teal-500 to-teal-600",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
];

export function Avatar({
  name,
  size = 56,
  accent,
  className,
}: {
  name: string;
  size?: number;
  accent?: string;
  className?: string;
}) {
  const idx = Math.abs(
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  ) % GRADIENTS.length;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-semibold text-white shadow-soft",
        GRADIENTS[idx],
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        ...(accent ? { backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}cc)` } : {}),
      }}
    >
      {initials(name).toUpperCase()}
    </div>
  );
}
