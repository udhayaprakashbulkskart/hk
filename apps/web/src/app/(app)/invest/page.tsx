import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from "@hkfinhub/ui";
import { PageHeader, Section, TabLinks } from "@/components/page";
import { TrendChart } from "@/components/charts";
import { OrderTicket } from "@/components/order-ticket";
import { api } from "@/lib/api";

const MARKETS = [
  { key: "all", label: "All" }, { key: "HK", label: "Hong Kong" }, { key: "US", label: "United States" }, { key: "IN", label: "India" },
] as const;

type SP = Promise<{ q?: string; market?: string; symbol?: string }>;

export default async function InvestPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const market = sp.market ?? "all";
  const all = await api.listMarket();
  const list = all.filter((m) => (market === "all" || m.market === market) && (!q || m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)));
  const selected = all.find((m) => m.symbol === sp.symbol) ?? all[0]!;
  const series = await api.getPriceHistory(selected.symbol);
  const base = `/invest${q ? `?q=${encodeURIComponent(sp.q ?? "")}` : ""}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Investments"
        title="Invest in global markets"
        description="Hong Kong, United States and India through licensed brokerage partners. Quotes are sample values and delayed."
        actions={<Link href="/invest/orders?tab=open" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--gold)] px-4 text-sm font-medium text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--gold-foreground)]">My orders</Link>}
      />

      <nav aria-label="Markets" className="flex gap-2 overflow-x-auto pb-1">
        {MARKETS.map((m) => {
          const href = `/invest?market=${m.key}${q ? `&q=${encodeURIComponent(sp.q ?? "")}` : ""}`;
          const active = market === m.key;
          return (
            <Link key={m.key} href={href} aria-current={active ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium", active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>{m.label}</Link>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{selected.name} <span className="text-[var(--muted-foreground)]">· {selected.symbol}</span></CardTitle>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{selected.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-sm text-[var(--muted-foreground)]">{selected.currency}</span></p>
              </div>
              <Badge tone={selected.changePct >= 0 ? "success" : "danger"}>{selected.changePct >= 0 ? "+" : ""}{selected.changePct.toFixed(2)}%</Badge>
            </CardHeader>
            <CardContent>
              <TrendChart
                ariaLabel={`Sample 30-day price chart for ${selected.symbol}. Not market data.`}
                data={series.map((p) => ({ label: p.date.slice(5), value: p.value }))}
                format={{ kind: "number", decimals: 2 }}
                height={240}
              />
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">Sample chart, not market data. Live charts need a licensed data feed.</p>
            </CardContent>
          </Card>

          <Section title="Market overview">
            <form action="/invest" role="search" className="max-w-sm">
              <input type="hidden" name="market" value={market} />
              <label htmlFor="q" className="sr-only">Search stocks, funds or symbols</label>
              <input id="q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search stocks, funds or symbols" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm" />
            </form>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">No matches. Try another symbol or market.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                {list.map((m) => (
                  <li key={m.symbol}>
                    <Link href={`${base}${base.includes("?") ? "&" : "?"}market=${market}&symbol=${encodeURIComponent(m.symbol)}`} className={cn("grid grid-cols-[1fr_auto] items-center gap-3 p-4 hover:bg-[var(--secondary)]", selected.symbol === m.symbol && "bg-[var(--secondary)]")}>
                      <span className="min-w-0"><span className="block truncate font-medium">{m.name}</span><span className="text-xs text-[var(--muted-foreground)]">{m.symbol} · {m.market}</span></span>
                      <span className="text-right tabular-nums"><span className="block font-semibold">{m.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span><span className={cn("text-xs", m.changePct >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]")}>{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <OrderTicket symbol={selected.symbol} price={selected.price} currency={selected.currency} />
          <Card>
            <CardHeader><CardTitle>Watchlist</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {all.slice(0, 4).map((m) => (
                <div key={m.symbol} className="flex justify-between text-sm"><span>{m.symbol}</span><span className="tabular-nums">{m.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
