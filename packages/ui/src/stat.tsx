import { cn } from "./cn";

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "neutral";
  className?: string;
}) {
  const subColor =
    tone === "up" ? "text-[var(--success)]" : tone === "down" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      <span className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</span>
      {sub ? <span className={cn("text-xs tabular-nums", subColor)}>{sub}</span> : null}
    </div>
  );
}
