"use client";
import { useEffect, useState } from "react";

const parts = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    ["Days", Math.floor(s / 86400)],
    ["Hrs", Math.floor((s % 86400) / 3600)],
    ["Min", Math.floor((s % 3600) / 60)],
    ["Sec", s % 60],
  ] as const;
};

/** Live countdown to a campaign/offer end time. Renders nothing once it has passed. */
export function Countdown({ endsAt, compact = false }: { endsAt: string; compact?: boolean }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (now != null && end <= now) return <span className="text-sm text-muted">Offer ended</span>;
  const p = parts(now == null ? 0 : end - now);
  return (
    <div className="flex items-center gap-1.5" role="timer" aria-label="Time remaining">
      {p.map(([label, v]) => (
        <div key={label} className={compact ? "min-w-10 rounded-md border border-neon/50 bg-[#17191c]/80 px-1.5 py-1 text-center" : "min-w-14 rounded-lg border border-neon/60 bg-gradient-to-b from-[#30353b] to-[#1f2226] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"}>
          <span key={now == null ? "x" : v} className={`tick block font-display font-bold tabular-nums text-neon-soft ${compact ? "text-sm" : "text-xl sm:text-2xl"}`}>{now == null ? "--" : String(v).padStart(2, "0")}</span>
          <span className="block text-[9px] tracking-widest text-[#8c959e] uppercase">{label}</span>
        </div>
      ))}
    </div>
  );
}
