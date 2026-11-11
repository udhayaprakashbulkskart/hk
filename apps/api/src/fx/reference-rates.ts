/**
 * Daily reference exchange rates from the European Central Bank, republished free by Frankfurter
 * (https://www.frankfurter.app). These are reference rates, not live or tradeable quotes, and they
 * are used for display only. Attribution is shown wherever the rates appear.
 */

export const REFERENCE_SOURCE = "European Central Bank reference rates, via Frankfurter";
export const REFERENCE_CURRENCIES = ["USD", "INR", "EUR", "GBP", "SGD", "CNY"] as const;
const BASE = "HKD";
const ENDPOINT = "https://api.frankfurter.app/latest";
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

export interface ReferenceRates {
  available: boolean;
  source: string;
  base: string;
  /** Date the ECB published these rates (YYYY-MM-DD). */
  date: string | null;
  /** Units of `currency` per 1 HKD. */
  rates: { currency: string; unitsPerHkd: number }[];
  note: string;
}

const UNAVAILABLE = (): ReferenceRates => ({
  available: false,
  source: REFERENCE_SOURCE,
  base: BASE,
  date: null,
  rates: [],
  note: "Reference rates are temporarily unavailable.",
});

let cache: { at: number; value: ReferenceRates } | null = null;

function isFrankfurterBody(x: unknown): x is { date: string; rates: Record<string, number> } {
  if (!x || typeof x !== "object") return false;
  const o = x as { date?: unknown; rates?: unknown };
  if (typeof o.date !== "string" || !o.rates || typeof o.rates !== "object") return false;
  return Object.values(o.rates as Record<string, unknown>).every((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
}

/** Returns cached reference rates, refreshing at most every six hours. Never throws. */
export async function getReferenceRates(): Promise<ReferenceRates> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const url = `${ENDPOINT}?base=${BASE}&symbols=${REFERENCE_CURRENCIES.join(",")}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body: unknown = await res.json();
    if (!isFrankfurterBody(body)) throw new Error("unexpected response");
    const value: ReferenceRates = {
      available: true,
      source: REFERENCE_SOURCE,
      base: BASE,
      date: body.date,
      rates: REFERENCE_CURRENCIES.filter((c) => typeof body.rates[c] === "number").map((c) => ({ currency: c, unitsPerHkd: body.rates[c]! })),
      note: "Daily reference rates. Not a live quote and not a rate you can transact at.",
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // Keep serving the last good value if we have one; otherwise say it is unavailable.
    return cache?.value ?? UNAVAILABLE();
  }
}
