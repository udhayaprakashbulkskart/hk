import { PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@hkfinhub/ui";
import { formatMoney } from "@hkfinhub/api-client";
import { api } from "@/lib/api";
import { DemoBalanceCard } from "@/components/demo-balance-card";

/** Dashboard shows the balance only. Deposit, withdrawal and other activity live on their own pages. */
export default async function DashboardPage() {
  const dash = await api.getDashboard();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Your Global Wealth Hub" title="Dashboard" description="Your balance." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Total cash balance</CardTitle>
            <Badge tone="neutral">HKD</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{formatMoney(dash.cashTotal)}</p>
          </CardContent>
        </Card>
        <DemoBalanceCard />
      </div>
    </div>
  );
}
