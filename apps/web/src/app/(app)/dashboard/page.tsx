import { PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@hkfinhub/ui";
import { formatMoney } from "@hkfinhub/api-client";
import { api } from "@/lib/api";
import { fetchReferenceRates, unitsPerHkd } from "@/lib/reference-rates";

/** Dashboard shows the balance only, in INR. Deposit, withdrawal and other activity live on their own pages. */
export default async function DashboardPage() {
  const [dash, ref] = await Promise.all([api.getDashboard(), fetchReferenceRates()]);
  const inrPerHkd = unitsPerHkd(ref, "INR");
  // Optional figure the account owner records by hand. Shown with a clear label, never as a platform balance.
  const manualRaw = process.env.MANUAL_BALANCE_INR;
  const manualInr = manualRaw && Number.isFinite(Number(manualRaw))
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(manualRaw))
    : null;
  const hkdMajor = Number(dash.cashTotal.amountMinor) / 100;
  const inrText = inrPerHkd
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(hkdMajor * inrPerHkd)
    : "Not available";
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Your Global Wealth Hub" title="Dashboard" description="Your balance." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Total balance</CardTitle>
            <Badge tone="neutral">INR</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {manualInr ? (
              <>
                <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{manualInr}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Entered manually by the account owner. Not held, verified or guaranteed by HK FinHub.
                </p>
              </>
            ) : (
              <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{inrText}</p>
            )}
            <p className="text-xs text-[var(--muted-foreground)]">
              {inrPerHkd && ref?.date
                ? `Converted from ${formatMoney(dash.cashTotal)} at the ECB reference rate for ${ref.date}. Not a live rate.`
                : `Held in ${formatMoney(dash.cashTotal)}. INR conversion needs the reference rate.`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
