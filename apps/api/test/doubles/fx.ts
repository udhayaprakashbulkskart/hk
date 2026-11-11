import { RATE_SCALE, type FxProvider } from "@hkfinhub/fx";

/**
 * Test rates. Illustrative values only, from the design sample table. Not market data, and never
 * shown as live. The real FX provider replaces this adapter (decision D3).
 */
const SAMPLE: Record<string, string> = {
  "HKD>USD": "0.1282", "USD>HKD": "7.8", "HKD>INR": "10.71", "INR>HKD": "0.0934", "HKD>EUR": "0.1185", "EUR>HKD": "8.44",
  "HKD>GBP": "0.1011", "GBP>HKD": "9.89", "HKD>AED": "0.4708", "AED>HKD": "2.124", "HKD>SGD": "0.1668", "SGD>HKD": "5.996",
  "HKD>CNY": "0.9176", "CNY>HKD": "1.09", "USD>INR": "83.5", "INR>USD": "0.012", "USD>EUR": "0.92", "EUR>USD": "1.087",
  "USD>GBP": "0.79", "GBP>USD": "1.266", "USD>SGD": "1.3", "SGD>USD": "0.769", "USD>CNY": "7.16", "CNY>USD": "0.1397",
  "USD>AED": "3.6725", "AED>USD": "0.2723", "EUR>GBP": "0.85", "GBP>EUR": "1.176", "EUR>INR": "90.8", "INR>EUR": "0.011",
  "GBP>INR": "105.7", "INR>GBP": "0.00946", "SGD>INR": "64.2", "INR>SGD": "0.01557", "CNY>INR": "11.7", "INR>CNY": "0.0855",
  "AED>INR": "22.75", "INR>AED": "0.044", "SGD>CNY": "5.5", "CNY>SGD": "0.1818",
};

export function toScaled(decimal: string): bigint {
  const [w, f = ""] = decimal.split(".");
  return BigInt(w!) * RATE_SCALE + BigInt((f + "0".repeat(8)).slice(0, 8));
}

export function createTestFxProvider(clock: () => Date = () => new Date()): FxProvider {
  return {
    id: "test-rates",
    async rate(from, to) {
      const r = SAMPLE[`${from}>${to}`];
      if (!r) throw new Error(`no test rate for ${from} to ${to}`);
      return { rateScaled: toScaled(r), quotedAt: clock() };
    },
    async history(from, to, days) {
      const base = SAMPLE[`${from}>${to}`];
      if (!base) return [];
      const b = toScaled(base);
      const out: { date: string; rateScaled: bigint }[] = [];
      for (let i = 0; i < days; i++) {
        // Deterministic sample wobble around the base rate. Labelled as sample in the API.
        const wobble = BigInt(Math.round(Math.sin(i / 3.2) * 120_000 + (i - days / 2) * 3_000));
        const d = new Date(Date.UTC(2026, 9, 13 + i));
        out.push({ date: d.toISOString().slice(0, 10), rateScaled: b + (b * wobble) / RATE_SCALE });
      }
      return out;
    },
  };
}
