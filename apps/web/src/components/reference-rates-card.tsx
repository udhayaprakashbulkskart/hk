import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";
import { fetchReferenceRates, unitsPerHkd } from "@/lib/reference-rates";

/** Server component: daily ECB reference FX rates with attribution. Not live, not a transaction rate. */
export async function ReferenceRatesCard() {
  const ref = await fetchReferenceRates();
  const rows = [
    { pair: "USD → HKD", v: unitsPerHkd(ref, "USD"), invert: true, dp: 4 },
    { pair: "EUR → HKD", v: unitsPerHkd(ref, "EUR"), invert: true, dp: 4 },
    { pair: "GBP → HKD", v: unitsPerHkd(ref, "GBP"), invert: true, dp: 4 },
    { pair: "HKD → INR", v: unitsPerHkd(ref, "INR"), invert: false, dp: 2 },
    { pair: "HKD → CNY", v: unitsPerHkd(ref, "CNY"), invert: false, dp: 4 },
    { pair: "HKD → SGD", v: unitsPerHkd(ref, "SGD"), invert: false, dp: 4 },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Currency reference rates</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.pair} className="flex justify-between tabular-nums">
            <span className="text-[var(--muted-foreground)]">{r.pair}</span>
            <span className="font-medium">{r.v ? (r.invert ? 1 / r.v : r.v).toFixed(r.dp) : "Not available"}</span>
          </div>
        ))}
        <p className="pt-2 text-xs text-[var(--muted-foreground)]">
          {ref?.available && ref.date
            ? `European Central Bank reference rates for ${ref.date}, via Frankfurter. Daily, not live, not a rate you can trade or transact at.`
            : "Reference rates are not available right now."}
        </p>
      </CardContent>
    </Card>
  );
}
