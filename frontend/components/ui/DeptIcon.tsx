import {
  Activity,
  HeartPulse,
  Sparkles,
  Stethoscope,
  Wind,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "heart-pulse": HeartPulse,
  wind: Wind,
  activity: Activity,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
};

export function DeptIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = MAP[icon] ?? Stethoscope;
  return <Icon className={className} />;
}
