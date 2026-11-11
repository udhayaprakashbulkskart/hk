/** Daily ECB reference rates served by the API. Display only; they are not live or tradeable quotes. */
export interface ReferenceRates {
  available: boolean;
  source: string;
  base: string;
  date: string | null;
  rates: { currency: string; unitsPerHkd: number }[];
  note: string;
}

export async function fetchReferenceRates(): Promise<ReferenceRates | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${base}/v1/fx/reference-rates`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as ReferenceRates;
  } catch {
    return null;
  }
}

/** Units of `currency` per 1 HKD, or null when unavailable. */
export function unitsPerHkd(ref: ReferenceRates | null, currency: string): number | null {
  return ref?.rates.find((r) => r.currency === currency)?.unitsPerHkd ?? null;
}
