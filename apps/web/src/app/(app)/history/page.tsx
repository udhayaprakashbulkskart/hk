import Link from "next/link";
import { Badge, cn } from "@hkfinhub/ui";
import { PageHeader } from "@/components/page";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Transaction } from "@hkfinhub/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "Money in" },
  { key: "out", label: "Money out" },
  { key: "trades", label: "Trades" },
  { key: "pending", label: "Pending" },
] as const;

const STATUS = { posted: { tone: "success", label: "Completed" }, pending: { tone: "gold", label: "Pending" }, failed: { tone: "danger", label: "Failed" }, reversed: { tone: "neutral", label: "Reversed" } } as const;

function applies(t: Transaction, f: string) {
  switch (f) {
    case "in": return BigInt(t.signedAmountMinor) > 0n;
    case "out": return BigInt(t.signedAmountMinor) < 0n && t.kind !== "trade";
    case "trades": return t.kind === "trade";
    case "pending": return t.status === "pending";
    default: return true;
  }
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.some((f) => f.key === rawFilter) ? rawFilter! : "all";
  const txns = (await api.listTransactions()).filter((t) => applies(t, filter));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Activity" title="Transaction history" description="Pending items update once our payment partner confirms them." />
      <nav aria-label="Filter transactions" className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/history?filter=${f.key}`} aria-current={filter === f.key ? "page" : undefined} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium", filter === f.key ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>{f.label}</Link>
        ))}
      </nav>
      {txns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">No transactions match this filter.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {txns.map((t) => {
            const s = STATUS[t.status];
            const n = BigInt(t.signedAmountMinor);
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] gap-3 p-4 sm:grid-cols-[1fr_180px_140px] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">{t.reference}</p>
                </div>
                <div className="hidden text-xs text-[var(--muted-foreground)] sm:block tabular-nums">{new Date(t.occurredAt).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-3">
                  <span className={cn("text-sm font-semibold tabular-nums", n > 0n && "text-[var(--success)]")}>{formatMoney({ amountMinor: n.toString(), currency: t.amount.currency }, { sign: true })}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
