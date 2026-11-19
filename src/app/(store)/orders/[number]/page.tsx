import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { GAME_LABEL } from "@/lib/constants";
import { BuyerItemActions } from "@/components/forms/order-actions";
import { PrintButton } from "@/components/ui/print-button";
import { StatusBadge } from "@/components/ui/badges";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage(props: PageProps<"/orders/[number]">) {
  const { number } = await props.params;
  const sp = await props.searchParams;
  const user = await pageUser(`/orders/${number}`);
  const order = await db.order.findUnique({
    where: { orderNumber: number },
    include: {
      items: { include: { review: true, product: { select: { slug: true } }, seller: { select: { id: true, seller: { select: { storeName: true } } } } } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order || (order.buyerId !== user.id && user.role !== "ADMIN")) notFound();
  const pay = order.payments.find((p) => p.status === "CAPTURED") ?? order.payments[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {sp.placed && order.status !== "PENDING_PAYMENT" && (
        <div className="card flex items-center gap-3 border-success/40 p-4 animate-fade-up">
          <CheckCircle2 className="size-6 text-success" />
          <div><p className="font-semibold">Order placed!</p><p className="text-sm text-muted">The seller has been notified to deliver to Player ID {order.gamePlayerId}.</p></div>
        </div>
      )}
      {order.status === "PENDING_PAYMENT" && (
        <div className="card flex items-center gap-3 border-warn/40 p-4">
          <Clock className="size-6 text-warn" />
          <p className="text-sm">Awaiting payment confirmation. If you completed payment, this updates automatically within a few minutes. Unpaid orders expire after 30 minutes.</p>
        </div>
      )}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-xs tracking-wider text-muted uppercase">Receipt</p>
            <h1 className="heading text-2xl">{order.orderNumber}</h1>
            <p className="text-sm text-muted">{order.createdAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge status={order.status} /><PrintButton /></div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-b border-line py-4 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Player ID</dt><dd className="font-semibold">{order.gamePlayerId}</dd></div>
          <div><dt className="text-muted">Game</dt><dd>{GAME_LABEL[order.game]}</dd></div>
          {order.gameNickname && <div><dt className="text-muted">Nickname</dt><dd className="font-semibold">{order.gameNickname}</dd></div>}
          <div><dt className="text-muted">Payment</dt><dd>{order.provider === "WALLET" ? "Wallet" : `Razorpay${pay?.method ? ` · ${pay.method}` : ""}`}</dd></div>
          <div><dt className="text-muted">Payment status</dt><dd>{pay ? <StatusBadge status={pay.status} /> : "—"}</dd></div>
          {pay?.razorpayPaymentId && <div className="col-span-2"><dt className="text-muted">Transaction ID</dt><dd className="font-mono text-xs">{pay.razorpayPaymentId}</dd></div>}
        </dl>
        <ul className="divide-y divide-line">
          {order.items.map((it) => (
            <li key={it.id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/product/${it.product.slug}`} className="font-semibold hover:text-neon">{it.titleSnapshot}</Link>
                  <p className="text-xs text-muted">Sold by <Link href={`/seller/${it.seller.id}`} className="hover:text-white">{it.seller.seller?.storeName}</Link> · {formatINR(it.unitPrice)} × {it.quantity}</p>
                </div>
                <div className="flex items-center gap-2"><StatusBadge status={it.status} /><span className="font-semibold">{formatINR(it.lineTotal - it.discount)}</span></div>
              </div>
              {it.deliveryNote && <p className="rounded-lg bg-panel-2 px-3 py-2 text-sm text-zinc-300"><span className="text-muted">Seller note:</span> {it.deliveryNote}</p>}
              {order.buyerId === user.id && <BuyerItemActions itemId={it.id} status={it.status} canReview={it.status === "COMPLETED" && !it.review} />}
              {it.review && <p className="text-xs text-muted">You rated this seller {it.review.rating}/5.</p>}
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-success"><span>Coupon {order.couponCode}</span><span>−{formatINR(order.discount)}</span></div>}
          <div className="flex justify-between font-display text-xl font-bold"><span>Total paid</span><span>{formatINR(order.total)}</span></div>
        </div>
        {order.refunds.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <h2 className="heading text-sm">Refunds</h2>
            {order.refunds.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-zinc-300">{formatINR(r.amount)} · {r.destination === "WALLET" ? "to wallet" : "to original payment"}{r.adminNote && <span className="text-muted"> — {r.adminNote}</span>}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">Need help? <Link href={`/contact?order=${order.orderNumber}`} className="text-neon">Contact support</Link></p>
    </div>
  );
}
