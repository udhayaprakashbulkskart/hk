"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@hkfinhub/types";
import { formatMoney } from "@/lib/money";

/** Serialisable value format. Functions cannot cross from Server to Client Components. */
export type ValueFormat =
  | { kind: "money-major"; currency: CurrencyCode }
  | { kind: "rate"; to: CurrencyCode }
  | { kind: "number"; decimals: number };

function formatValue(v: number, f: ValueFormat): string {
  switch (f.kind) {
    case "money-major":
      return formatMoney({ amountMinor: String(Math.round(v * 100)), currency: f.currency });
    case "rate":
      return `${v.toFixed(4)} ${f.to}`;
    case "number":
      return v.toFixed(f.decimals);
  }
}

/** Reads a CSS variable and updates when the theme attribute changes, so SVG colours follow light/dark. */
function useCssVar(name: string, fallback: string): string {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const read = () => setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [name, fallback]);
  return value;
}

export interface TrendPoint {
  label: string;
  value: number;
}

/** Area trend chart. Values are display numbers; the caller formats them. */
export function TrendChart({
  data,
  height = 220,
  format,
  ariaLabel,
  colorVar = "--chart-1",
}: {
  data: TrendPoint[];
  height?: number;
  format: ValueFormat;
  ariaLabel: string;
  colorVar?: string;
}) {
  const color = useCssVar(colorVar, "#c6a34a");
  const grid = useCssVar("--border", "#2a2f3a");
  const muted = useCssVar("--muted-foreground", "#a8adb8");
  const card = useCssVar("--card", "#141821");
  const gradientId = `grad-${colorVar.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            formatter={(v) => formatValue(Number(v), format)}
            contentStyle={{ background: card, border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: muted }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small inline sparkline for summary cards. */
export function Sparkline({ values, colorVar = "--success", height = 56 }: { values: number[]; colorVar?: string; height?: number }) {
  const color = useCssVar(colorVar, "#159b70");
  const data = values.map((value, i) => ({ label: String(i), value }));
  return (
    <div aria-hidden="true" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="none" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
