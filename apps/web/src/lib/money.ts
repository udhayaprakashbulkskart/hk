import type { CurrencyCode, Money } from "@hkfinhub/types";

/** Minor-unit exponent for every launch currency. Adding a currency is a data change. */
export const MINOR_EXPONENT: Record<CurrencyCode, number> = {
  HKD: 2, USD: 2, INR: 2, EUR: 2, GBP: 2, AED: 2, SGD: 2, CNY: 2,
};

const LOCALE_BY_CURRENCY: Partial<Record<CurrencyCode, string>> = {
  HKD: "en-HK", USD: "en-US", INR: "en-IN", EUR: "en-IE", GBP: "en-GB", AED: "en-AE", SGD: "en-SG", CNY: "zh-CN",
};

/** Format integer minor units for display. Display only; never used for arithmetic. */
export function formatMoney(m: Money, opts: { sign?: boolean } = {}): string {
  const exp = MINOR_EXPONENT[m.currency];
  const raw = BigInt(m.amountMinor);
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const divisor = 10n ** BigInt(exp);
  const whole = abs / divisor;
  const frac = (abs % divisor).toString().padStart(exp, "0");
  const formatted = new Intl.NumberFormat(LOCALE_BY_CURRENCY[m.currency] ?? "en", {
    style: "currency",
    currency: m.currency,
    currencyDisplay: "code",
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(Number(`${whole}.${frac}`));
  const body = formatted.replace(/ /g, " ");
  if (neg) return `−${body}`;
  if (opts.sign && raw > 0n) return `+${body}`;
  return body;
}

/** Parse a user-entered decimal string into minor units. Returns null when invalid. */
export function parseToMinor(input: string, currency: CurrencyCode): string | null {
  const exp = MINOR_EXPONENT[currency];
  const cleaned = input.replace(/,/g, "").trim();
  const re = new RegExp(`^\\d+(\\.\\d{1,${exp}})?$`);
  if (!re.test(cleaned)) return null;
  const [w, f = ""] = cleaned.split(".");
  return (BigInt(w!) * 10n ** BigInt(exp) + BigInt((f + "0".repeat(exp)).slice(0, exp))).toString();
}

export function minorToMajorNumber(amountMinor: string, currency: CurrencyCode): number {
  return Number(amountMinor) / 10 ** MINOR_EXPONENT[currency];
}
