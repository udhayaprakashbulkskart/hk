/**
 * Launch currency metadata. The single source for minor-unit exponents, used by the ledger,
 * the database seed and the clients. Adding a currency is a reviewed data change, not a code change.
 */
export const LAUNCH_CURRENCIES = ["HKD", "USD", "INR", "EUR", "GBP", "AED", "SGD", "CNY"] as const;
export type LaunchCurrency = (typeof LAUNCH_CURRENCIES)[number];

export interface CurrencyMeta {
  code: LaunchCurrency;
  name: string;
  symbol: string;
  /** Digits after the decimal point, so 1 major unit = 10^exponent minor units. */
  minorUnitExponent: number;
}

export const CURRENCY_META: Record<LaunchCurrency, CurrencyMeta> = {
  HKD: { code: "HKD", name: "Hong Kong dollar", symbol: "HK$", minorUnitExponent: 2 },
  USD: { code: "USD", name: "US dollar", symbol: "US$", minorUnitExponent: 2 },
  INR: { code: "INR", name: "Indian rupee", symbol: "₹", minorUnitExponent: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", minorUnitExponent: 2 },
  GBP: { code: "GBP", name: "Pound sterling", symbol: "£", minorUnitExponent: 2 },
  AED: { code: "AED", name: "UAE dirham", symbol: "AED", minorUnitExponent: 2 },
  SGD: { code: "SGD", name: "Singapore dollar", symbol: "S$", minorUnitExponent: 2 },
  CNY: { code: "CNY", name: "Chinese yuan", symbol: "¥", minorUnitExponent: 2 },
};

export function isLaunchCurrency(code: string): code is LaunchCurrency {
  return (LAUNCH_CURRENCIES as readonly string[]).includes(code);
}

/** Parses a decimal string such as "1,250.50" into integer minor units for a currency. Returns null if invalid. */
export function parseMinor(input: string, currency: LaunchCurrency): bigint | null {
  const exp = CURRENCY_META[currency].minorUnitExponent;
  const cleaned = input.replace(/,/g, "").trim();
  if (!new RegExp(`^\\d+(\\.\\d{1,${exp}})?$`).test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 10n ** BigInt(exp) + BigInt((frac + "0".repeat(exp)).slice(0, exp));
}

/** Formats integer minor units as a plain decimal string. Display helpers live in clients. */
export function minorToDecimal(amountMinor: bigint, currency: LaunchCurrency): string {
  const exp = CURRENCY_META[currency].minorUnitExponent;
  const neg = amountMinor < 0n;
  const abs = neg ? -amountMinor : amountMinor;
  const div = 10n ** BigInt(exp);
  const s = `${abs / div}.${(abs % div).toString().padStart(exp, "0")}`;
  return neg ? `-${s}` : s;
}
