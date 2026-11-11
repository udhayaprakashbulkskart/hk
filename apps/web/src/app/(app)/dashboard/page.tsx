import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Send, Download, TrendingUp, TrendingDown, Globe2, Briefcase, ArrowRight } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Stat, cn } from "@hkfinhub/ui";
import { ReceivingAccountCard } from "@/components/receiving-account";
import { PageHeader, Section } from "@/components/page";
import { TrendChart, Sparkline } from "@/components/charts";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Transaction } from "@hkfinhub/types";

const QUICK = [
  { href: "/send", label: "Send Money", icon: Send },
  { href: "/receive", label: "Receive", icon: Download },
  { href: "/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/transfer", label: "Global Transfer", icon: Globe2 },
  { href: "/invest", label: "Buy Stocks", icon: TrendingUp },
  { href: "/invest/orders?tab=open", label: "Sell Stocks", icon: TrendingDown },
  { href: "/portfolio", label: "View Portfolio", icon: Briefcase },
] as const;

const STATUS_TONE = { posted: "success", pending: "gold", failed: "danger", reversed: "neutral" } as const;
const STATUS_LABEL = { posted: "Completed", pending: "Pending", failed: "Failed", reversed: "Reversed" } as const;

function signed(t: Transaction) {
  const n = BigInt(t.signedAmountMinor);
  return formatMoney({ amountMinor: n.toString(), currency: t.amount.currency }, { sign: true });
}

export default async function DashboardPage() {
  const [dash, txns, history, market, notifications, fxUsd, fxInr, fxEur, fxGbp] = await Promise.all([
    api.getDashboard(),
    api.listTransactions(),
    api.getPortfolioHistory(),
    api.listMarket(),
    api.listNotifications(),
    api.getFxQuote("HKD", "USD", "10000"),
    api.getFxQuote("HKD", "INR", "10000"),
    api.getFxQuote("EUR", "HKD", "10000"),
    api.getFxQuote("GBP", "HKD", "10000"),
  ]);
  const cash = dash.cashTotal;
  const cashUsd = await api.getFxQuote("HKD", "USD", cash.amountMinor);
  const pnl = dash.investmentValue.unrealisedPnl;
  const pnlTone = BigInt(pnl.amountMinor) >= 0n ? "up" : "down";
  const unread = notifications.filter((n) => !n.read).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your Global Wealth Hub"
        title="Dashboard"
        description="Cash balances and investment valuations are shown separately."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cash: the total is cash only */}
        <Card className="relative overflow-hidden lg:col-span-2">
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Total cash balance</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">{formatMoney(cash)}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)] tabular-nums">
                  {cashUsd ? `≈ ${formatMoney(cashUsd.recipientAmount)} at the quoted rate` : "USD equivalent appears once live rates are connected"} · excludes investments
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/deposit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"><ArrowDownToLine className="size-4" aria-hidden="true" />Deposit</Link>
              <Link href="/send" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--secondary)]"><Send className="size-4" aria-hidden="true" />Transfer</Link>
              <Link href="/withdraw" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--secondary)]"><ArrowUpFromLine className="size-4" aria-hidden="true" />Withdraw</Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Investment value</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Stat label="Market value" value={formatMoney(dash.investmentValue.marketValue)} />
            <Stat
              label="Unrealised P&L"
              value={formatMoney(pnl, { sign: true })}
              sub={`${dash.investmentValue.unrealisedPnlPct >= 0 ? "+" : ""}${dash.investmentValue.unrealisedPnlPct.toFixed(2)}% · ${dash.investmentValue.source}`}
              tone={pnlTone}
            />
            <Sparkline values={history.slice(-12).map((p) => p.value)} colorVar={pnlTone === "up" ? "--success" : "--destructive"} height={44} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Portfolio performance</CardTitle>
            <Link href="/portfolio" className="text-sm font-medium text-[var(--gold)] hover:underline">Details</Link>
          </CardHeader>
          <CardContent>
            <TrendChart
              ariaLabel="Portfolio value over the last 30 days"
              data={history.map((p) => ({ label: p.date.slice(5), value: p.value }))}
              format={{ kind: "money-major", currency: "HKD" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {dash.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-[var(--secondary)]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{a.reference}{a.kind === "demat" ? " · investment, not cash" : ""}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(a.balance)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QUICK.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} className="flex min-h-20 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm font-medium transition-colors hover:border-[var(--gold)]/60 hover:bg-[var(--secondary)]">
              <Icon className="size-5 text-[var(--gold)]" aria-hidden="true" />
              <span className="mt-3">{label}</span>
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReceivingAccountCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Link href="/history" className="text-sm font-medium text-[var(--gold)] hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--border)]">
            {txns.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{new Date(t.occurredAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" })} · <Badge tone={STATUS_TONE[t.status]} className="align-middle">{STATUS_LABEL[t.status]}</Badge></p>
                </div>
                <p className={cn("shrink-0 text-sm font-semibold tabular-nums", BigInt(t.signedAmountMinor) >= 0n ? "text-[var(--success)]" : "text-[var(--foreground)]")}>{signed(t)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Notifications</CardTitle>
            <Link href="/notifications" className="text-sm font-medium text-[var(--gold)] hover:underline">All</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {unread.map((n) => (
              <div key={n.id} className="rounded-lg bg-[var(--secondary)] p-3">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{n.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Exchange rates</CardTitle>
            <Link href="/exchange" className="text-sm font-medium text-[var(--gold)] hover:underline">Convert</Link>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { pair: "USD → HKD", rate: fxUsd ? (1 / fxUsd.rate).toFixed(4) : null },
              { pair: "HKD → INR", rate: fxInr ? fxInr.rate.toFixed(2) : null },
              { pair: "EUR → HKD", rate: fxEur ? fxEur.rate.toFixed(4) : null },
              { pair: "GBP → HKD", rate: fxGbp ? fxGbp.rate.toFixed(4) : null },
            ].map((r) => (
              <div key={r.pair} className="flex justify-between tabular-nums"><span className="text-[var(--muted-foreground)]">{r.pair}</span><span className="font-medium">{r.rate ?? "Not connected"}</span></div>
            ))}
            <p className="pt-2 text-xs text-[var(--muted-foreground)]">Rates appear once our FX provider is connected. Every transfer shows a live quote first.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Market overview</CardTitle>
            <Link href="/invest" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--gold)] hover:underline">Investments <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {market.length === 0 && <p className="text-sm text-[var(--muted-foreground)] sm:col-span-2 lg:col-span-4">Market data is not connected yet.</p>}
            {market.slice(0, 4).map((q) => (
              <div key={q.symbol} className="rounded-xl bg-[var(--secondary)] p-3">
                <p className="text-xs text-[var(--muted-foreground)]">{q.symbol}</p>
                <p className="mt-1 font-semibold tabular-nums">{q.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                <p className={cn("text-xs tabular-nums", q.changePct >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]")}>{q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%</p>
              </div>
            ))}
            <p className="text-xs text-[var(--muted-foreground)] sm:col-span-2 lg:col-span-4">Market data is shown only once it is licensed and connected.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

