/** Money helpers. All amounts are integer paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export function formatINR(paise: number) {
  return inr.format(paise / 100);
}

/** Commission in paise for a line total, using basis points (1000 = 10%). Rounded half-up. */
export function commissionFor(lineTotal: number, rateBps: number) {
  return Math.round((lineTotal * rateBps) / 10_000);
}

export function discountPercent(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
