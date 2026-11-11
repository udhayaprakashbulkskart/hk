import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Stat, cn } from "@hkfinhub/ui";
import { PageHeader, Section } from "@/components/page";
import { TrendChart } from "@/components/charts";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function PortfolioPage() {
  const [dash, holdings, history] = await Promise.all([api.getDashboard(), api.listHoldings(), api.getPortfolioHistory()]);
  const pnl = dash.investmentValue.unrealisedPnl;
  const up = BigInt(pnl.amountMinor) >= 0n;
  const byMarket = ["HK", "US", "IN"].map((m) => ({ m, n: holdings.filter((h) => h.market === m).length }));
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Investments"
        title="My portfolio"
        description="Investment valuations are separate from your cash balances."
        actions={<Link href="/reports" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--gold)] px-4 text-sm font-medium text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--gold-foreground)]">Statements</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><Stat label="Market value" value={formatMoney(dash.investmentValue.marketValue)} sub={dash.investmentValue.source} /></CardContent></Card>
        <Card><CardContent className="pt-6"><Stat label="Unrealised P&L" value={formatMoney(pnl, { sign: true })} sub={`${dash.investmentValue.unrealisedPnlPct >= 0 ? "+" : ""}${dash.investmentValue.unrealisedPnlPct.toFixed(2)}%`} tone={up ? "up" : "down"} /></CardContent></Card>
        <Card><CardContent className="pt-6"><Stat label="Holdings" value={String(holdings.length)} sub={byMarket.filter((x) => x.n).map((x) => `${x.m} ${x.n}`).join(" · ")} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Performance · 30 days</CardTitle></CardHeader>
        <CardContent>
          <TrendChart ariaLabel="Portfolio value over 30 days" data={history.map((p) => ({ label: p.date.slice(5), value: p.value }))} format={{ kind: "money-major", currency: "HKD" }} height={260} />
        </CardContent>
      </Card>

      <Section title="Holdings">
        <div className="grid gap-3 md:grid-cols-2">
          {holdings.map((h) => {
            const value = h.quantity * h.lastPrice;
            const cost = h.quantity * h.avgCost;
            const gain = value - cost;
            return (
              <Card key={h.symbol}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{h.name}</p><p className="text-xs text-[var(--muted-foreground)]">{h.symbol} · {h.quantity} shares · avg {h.avgCost.toFixed(2)} {h.currency}</p></div>
                    <Badge tone="neutral">{h.market}</Badge>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-xs text-[var(--muted-foreground)]">Value</p><p className="font-semibold tabular-nums">{value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {h.currency}</p></div>
                    <p className={cn("text-sm font-medium tabular-nums", gain >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]")}>{gain >= 0 ? "+" : "−"}{Math.abs(gain).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">Holdings come from your brokerage partner once investments are connected. Values are in each holding&apos;s own currency.</p>
      </Section>
    </div>
  );
}
