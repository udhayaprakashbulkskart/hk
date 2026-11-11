import { minorToDecimal, CURRENCY_META, type LaunchCurrency } from "@hkfinhub/shared";

/** Display string for a minor-unit amount, e.g. "HK$ 1,234.50". Clients may format their own locale. */
export function formatMinor(amount: bigint, currency: LaunchCurrency): string {
  const decimal = minorToDecimal(amount, currency);
  const [whole = "0", frac = "00"] = decimal.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0n ? "-" : ""}${CURRENCY_META[currency].symbol} ${grouped}.${frac}`;
}
