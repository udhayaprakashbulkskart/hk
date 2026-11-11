"use client";

import { useEffect, useState } from "react";
import { cn } from "@hkfinhub/ui";

type Theme = "light" | "dark";

export function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);
  function choose(t: Theme) {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("hkf-theme", t); } catch { /* storage unavailable: applies for this view only */ }
  }
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">Theme</legend>
      {(["dark", "light"] as const).map((t) => (
        <label key={t} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-medium", theme === t ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]")}>
          <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => choose(t)} className="size-4 accent-[var(--primary)]" />
          {t === "dark" ? "Dark (default)" : "Light"}
        </label>
      ))}
    </fieldset>
  );
}

const PREFS = [
  { id: "p-pay", label: "Payments received and transfers", locked: false },
  { id: "p-kyc", label: "Verification updates", locked: false },
  { id: "p-marketing", label: "Product news", locked: false },
  { id: "p-security", label: "Security alerts (always on)", locked: true },
];

export function PreferenceToggles() {
  const [on, setOn] = useState<Record<string, boolean>>({ "p-pay": true, "p-trade": true, "p-kyc": true, "p-marketing": false, "p-security": true });
  return (
    <ul className="divide-y divide-[var(--border)]">
      {PREFS.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-4 py-3">
          <label htmlFor={p.id} className="text-sm">{p.label}</label>
          <input id={p.id} type="checkbox" checked={on[p.id]} disabled={p.locked} onChange={(e) => setOn({ ...on, [p.id]: e.target.checked })} className="size-5 accent-[var(--primary)] disabled:opacity-60" />
        </li>
      ))}
      <li className="pt-3 text-xs text-[var(--muted-foreground)]">Preferences are saved to your account once live sign-in is connected.</li>
    </ul>
  );
}
