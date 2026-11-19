import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Hourglass, IndianRupee, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { razorpayConfigured } from "@/lib/razorpay";
import { TopupForm, WithdrawForm } from "@/components/forms/wallet-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Wallet" };

export default async function WalletPage() {
  const user = await pageUser("/wallet");
  const isSeller = user.seller?.status === "VERIFIED";
  const [txns, withdrawals, earned, pending, profile, monthly] = await Promise.all([
    db.walletTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.orderItem.aggregate({ where: { sellerId: user.id, earningCredited: true }, _sum: { sellerEarning: true, commission: true } }),
    db.orderItem.aggregate({ where: { sellerId: user.id, status: { in: ["PROCESSING", "DELIVERED", "REFUND_REQUESTED"] } }, _sum: { sellerEarning: true } }),
    db.sellerProfile.findUnique({ where: { userId: user.id }, select: { payoutUpi: true } }),
    db.$queryRaw<{ month: string; total: bigint }[]>`
      SELECT to_char(date_trunc('month', "completedAt"), 'Mon') AS month, SUM("sellerEarning")::bigint AS total
      FROM "OrderItem" WHERE "sellerId" = ${user.id} AND "earningCredited" = true AND "completedAt" > now() - interval '6 months'
      GROUP BY date_trunc('month', "completedAt") ORDER BY date_trunc('month', "completedAt")`,
  ]);
  const maxMonth = Math.max(1, ...monthly.map((m) => Number(m.total)));

  return (
    <div className="space-y-6">
      <PageTitle title="Wallet" subtitle="Balance, top-ups, earnings and withdrawals." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card relative overflow-hidden p-6 lg:col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-neon/25 to-crimson/10" />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm text-zinc-300"><WalletIcon className="size-4 text-neon" /> Wallet balance</p>
            <p className="mt-2 font-display text-4xl font-bold">{formatINR(user.walletBalance)}</p>
          </div>
        </div>
        {isSeller && (
          <>
            <div className="card p-6">
              <p className="flex items-center gap-2 text-sm text-muted"><TrendingUp className="size-4 text-success" /> Total earned</p>
              <p className="mt-2 font-display text-3xl font-bold">{formatINR(earned._sum.sellerEarning ?? 0)}</p>
              <p className="text-xs text-muted">after {formatINR(earned._sum.commission ?? 0)} platform commission</p>
            </div>
            <div className="card p-6">
              <p className="flex items-center gap-2 text-sm text-muted"><Hourglass className="size-4 text-warn" /> Pending release</p>
              <p className="mt-2 font-display text-3xl font-bold">{formatINR(pending._sum.sellerEarning ?? 0)}</p>
              <p className="text-xs text-muted">released when buyers confirm delivery</p>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="heading mb-3 text-lg">Add money</h2>
          <TopupForm enabled={razorpayConfigured()} />
        </section>
        {isSeller ? (
          <section className="card p-5">
            <h2 className="heading mb-3 text-lg">Withdraw earnings</h2>
            <WithdrawForm defaultUpi={profile?.payoutUpi} max={user.walletBalance} />
          </section>
        ) : (
          <section className="card p-5 text-sm text-muted">
            <h2 className="heading mb-2 text-lg text-white">How your wallet works</h2>
            Wallet balance can be used for any purchase. Refunds land in this wallet instantly.
          </section>
        )}
      </div>

      {isSeller && monthly.length > 0 && (
        <section className="card p-5">
          <h2 className="heading mb-4 text-lg">Earnings · last 6 months</h2>
          <div className="flex h-40 items-end gap-3" role="img" aria-label="Monthly earnings bar chart">
            {monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] text-muted">{formatINR(Number(m.total))}</span>
                <div className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-crimson to-neon" style={{ height: `${(Number(m.total) / maxMonth) * 100}%`, minHeight: 4 }} />
                <span className="text-xs text-zinc-400">{m.month}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {withdrawals.length > 0 && (
        <section className="card overflow-x-auto p-5">
          <h2 className="heading mb-3 text-lg">Withdrawal requests</h2>
          <table className="table-base">
            <thead><tr><th>Date</th><th>UPI</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="text-muted">{w.createdAt.toLocaleDateString("en-IN")}</td><td>{w.upiId}</td><td>{formatINR(w.amount)}</td>
                  <td><StatusBadge status={w.status} /></td><td className="font-mono text-xs">{w.payoutRef ?? w.adminNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card p-5">
        <h2 className="heading mb-3 text-lg">Transaction history</h2>
        {txns.length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className={`grid size-9 place-items-center rounded-full ${t.type === "CREDIT" ? "bg-success/15 text-success" : "bg-neon/15 text-neon"}`}>
                  {t.type === "CREDIT" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.note ?? t.reason.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="text-xs text-muted">{t.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{t.reference && t.reference !== "seed" ? ` · ${t.reference}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${t.type === "CREDIT" ? "text-success" : "text-zinc-200"}`}>{t.type === "CREDIT" ? "+" : "−"}{formatINR(t.amount)}</p>
                  <p className="flex items-center justify-end gap-0.5 text-[11px] text-muted"><IndianRupee className="size-2.5" />{(t.balanceAfter / 100).toLocaleString("en-IN")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
