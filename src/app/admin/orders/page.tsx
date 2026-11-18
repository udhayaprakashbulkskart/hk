import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Orders & payments" };
const TABS = ["ALL", "PENDING_PAYMENT", "PAID", "COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] as const;

export default async function AdminOrders(props: PageProps<"/admin/orders">) {
  const sp = await props.searchParams;
  const status = pick(sp.status, TABS, "ALL");
  const view = sp.view === "payments" ? "payments" : "orders";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const payments = view === "payments" ? await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { orderNumber: true } }, topup: { select: { user: { select: { email: true } } } } } }) : [];
  const orders = view === "orders"
    ? await db.order.findMany({
        where: { ...(status !== "ALL" ? { status } : {}), ...(q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" as const } }, { buyer: { email: { contains: q, mode: "insensitive" as const } } }] } : {}) },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { buyer: { select: { email: true } }, items: { include: { seller: { select: { seller: { select: { storeName: true } } } } } } },
      })
    : [];

  return (
    <div>
      <PageTitle title="Orders & payments" subtitle="Track orders, fulfilment and every payment transaction.">
        <div className="flex gap-2">
          <Link href="/admin/orders" className={`chip ${view === "orders" ? "chip-active" : ""}`}>Orders</Link>
          <Link href="/admin/orders?view=payments" className={`chip ${view === "payments" ? "chip-active" : ""}`}>Transactions</Link>
        </div>
      </PageTitle>
      {view === "payments" ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>For</th><th>Provider</th><th>Amount</th><th>Status</th><th>Gateway IDs</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-muted">{p.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{p.order ? <Link className="hover:text-neon" href={`/orders/${p.order.orderNumber}`}>{p.order.orderNumber}</Link> : `Wallet top-up · ${p.topup?.user.email}`}</td>
                  <td>{p.provider}{p.method ? ` · ${p.method}` : ""}</td><td>{formatINR(p.amount)}</td>
                  <td><StatusBadge status={p.status} />{p.failureReason && <p className="text-xs text-muted">{p.failureReason}</p>}</td>
                  <td className="font-mono text-[11px] text-muted">{p.razorpayOrderId ?? "—"}<br />{p.razorpayPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <StatusTabs base="/admin/orders" tabs={TABS} current={status} />
            <form className="mb-4"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={q} placeholder="Order # or buyer email" className="input w-64" /></form>
          </div>
          {orders.length === 0 ? <EmptyState title="No orders" /> : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/orders/${o.orderNumber}`} className="font-semibold hover:text-neon">{o.orderNumber}</Link>
                    <StatusBadge status={o.status} />
                    <span className="text-xs text-muted">{o.buyer.email} · Player ID {o.gamePlayerId} · {o.provider} · {o.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    <span className="ml-auto font-semibold">{formatINR(o.total)} <span className="text-xs text-muted">(fee {formatINR(o.platformFee)})</span></span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {o.items.map((it) => (
                      <li key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-panel-2 px-3 py-2 text-sm">
                        <span className="flex-1">{it.titleSnapshot} × {it.quantity} <span className="text-xs text-muted">· {it.seller.seller?.storeName}</span></span>
                        <StatusBadge status={it.status} />
                        {it.status === "PROCESSING" && <ActionButton url={`/api/order-items/${it.id}/deliver`} method="POST" label="Mark delivered" prompt="Delivery note (e.g. UC credited, ref no.):" promptKey="deliveryNote" success="Marked delivered" />}
                        {it.status === "DELIVERED" && <ActionButton url={`/api/order-items/${it.id}/complete`} method="POST" label="Force complete" confirm="Release funds to the seller?" success="Completed" />}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
