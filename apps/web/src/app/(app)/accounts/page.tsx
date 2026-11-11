import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Stat } from "@hkfinhub/ui";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function AccountsPage() {
  const [dash, balances, beneficiaries] = await Promise.all([api.getDashboard(), api.listCurrencyBalances(), api.listBeneficiaries()]);
  const deposits = dash.totals.deposits;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Your accounts" title="Accounts" description="Cash is shown per currency. Investments are valued separately and are not counted as cash." actions={<Link href="/deposit" className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)]">Add funds</Link>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><Stat label="Cash balance (HKD)" value={formatMoney(dash.cashTotal)} /></CardContent></Card>
        <Card><CardContent className="pt-6"><Stat label="Total deposits" value={formatMoney(deposits)} /></CardContent></Card>
        <Card><CardContent className="pt-6"><Stat label="Total withdrawals" value={formatMoney(dash.totals.withdrawals)} /></CardContent></Card>
      </div>

      <Section title="Cash accounts">
        <div className="grid gap-4 md:grid-cols-3">
          {dash.accounts.filter((a) => a.kind !== "demat").map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{a.name}</CardTitle>
                <Badge tone="neutral">{a.reference}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{formatMoney(a.balance)}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Available · pending transfers shown in history</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Currency balances">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {balances.map((b) => {
              const funded = BigInt(b.total.amountMinor) > 0n;
              return (
                <li key={b.currency} className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:grid-cols-[120px_1fr_1fr_1fr_auto]">
                  <span className="font-semibold">{b.currency}</span>
                  <span className="hidden text-sm tabular-nums sm:block"><span className="block text-xs text-[var(--muted-foreground)]">Available</span>{formatMoney(b.available)}</span>
                  <span className="hidden text-sm tabular-nums sm:block"><span className="block text-xs text-[var(--muted-foreground)]">Pending</span>{formatMoney(b.pending)}</span>
                  <span className="hidden text-sm tabular-nums sm:block"><span className="block text-xs text-[var(--muted-foreground)]">Total</span>{formatMoney(b.total)}</span>
                  {funded ? (
                    <span className="text-right text-sm tabular-nums sm:hidden">{formatMoney(b.total)}</span>
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Available once currency accounts are enabled"><Plus className="size-3.5" aria-hidden="true" />Open</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">Opening a currency account is available once account verification is complete.</p>
      </Section>

      <Section title="Saved recipients" action={<Link href="/send" className="text-sm font-medium text-[var(--gold)] hover:underline">Send money</Link>}>
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {beneficiaries.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0"><p className="truncate font-medium">{b.name}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{b.destination}</p></div>
              <Badge tone="neutral">{b.method.toUpperCase()} · {b.currency}</Badge>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
