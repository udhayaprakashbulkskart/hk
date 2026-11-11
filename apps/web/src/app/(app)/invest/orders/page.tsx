import { PageHeader, EmptyState, TabLinks } from "@/components/page";
import { Badge } from "@hkfinhub/ui";
import { api } from "@/lib/api";

const TABS = [
  { key: "open", label: "Open orders" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "trades", label: "Trade history" },
] as const;

const STATE_TONE = { open: "gold", partially_filled: "gold", filled: "success", cancelled: "neutral", rejected: "danger" } as const;
const STATE_LABEL = { open: "Open", partially_filled: "Partly filled", filled: "Filled", cancelled: "Cancelled", rejected: "Rejected" } as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "open";
  const orders = await api.listOrders();
  const rows = orders.filter((o) => {
    if (tab === "open") return o.state === "open" || o.state === "partially_filled";
    if (tab === "completed" || tab === "trades") return o.state === "filled" || o.state === "partially_filled";
    return o.state === "cancelled" || o.state === "rejected";
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Investments" title="Orders and trades" description="Every order and its status, from the brokerage partner." />
      <TabLinks tabs={[...TABS]} active={tab} basePath="/invest/orders" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Orders appear here after you place them. Trading is not yet enabled in this sandbox." />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {rows.map((o) => (
            <li key={o.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-medium"><span className={o.side === "buy" ? "text-[var(--success)]" : "text-[var(--destructive)]"}>{o.side.toUpperCase()}</span> {o.symbol} × {o.quantity}</p>
                <p className="text-xs text-[var(--muted-foreground)] tabular-nums">{o.id} · {new Date(o.placedAt).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} HKT · {o.limitPrice ? `Limit ${o.limitPrice} ${o.currency}` : "Market"}</p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="text-sm tabular-nums">{o.filled}/{o.quantity} filled</span>
                <Badge tone={STATE_TONE[o.state]}>{STATE_LABEL[o.state]}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
