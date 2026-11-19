import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { GAME_LABEL } from "@/lib/constants";
import { Frame } from "@/components/ui/frame";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

/**
 * Landing page after checkout. It never assumes success: the state shown comes from the order
 * record, which only becomes PAID after server-side verification (Razorpay signature + fetch, or wallet debit).
 */
export default async function PaymentSuccessPage(props: PageProps<"/payment/success">) {
  const sp = await props.searchParams;
  const number = typeof sp.order === "string" ? sp.order : "";
  const user = await pageUser(`/payment/success?order=${encodeURIComponent(number)}`);
  if (!number) notFound();
  const order = await db.order.findUnique({
    where: { orderNumber: number },
    select: { orderNumber: true, buyerId: true, status: true, total: true, discount: true, couponCode: true, gamePlayerId: true, gameNickname: true, game: true, items: { select: { titleSnapshot: true, quantity: true } } },
  });
  if (!order || order.buyerId !== user.id) notFound();

  const paid = ["PAID", "COMPLETED", "PARTIALLY_REFUNDED"].includes(order.status);
  const pending = order.status === "PENDING_PAYMENT";
  const Icon = paid ? CheckCircle2 : pending ? Clock : XCircle;
  const title = paid ? "Payment confirmed" : pending ? "Confirming your payment" : "Payment not completed";
  const body = paid
    ? "Your payment has been verified. The seller (or our team, for UC) has been notified to deliver to the Player ID below."
    : pending
      ? "We haven't received confirmation from the payment provider yet. If you completed payment, this page and your order update automatically once it's verified. Unpaid orders expire after 30 minutes."
      : "This order wasn't paid. If money was debited anyway, contact support with this order number and we will resolve it. You can place the order again.";

  return (
    <div className="mx-auto max-w-xl py-6">
      <Frame>
        <div className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
          <span className={`grid size-16 place-items-center rounded-full border-2 ${paid ? "border-success text-success" : pending ? "border-neon text-neon" : "border-mint text-mint"}`}>
            <Icon className="size-8" />
          </span>
          <h1 className="heading gold-text text-3xl">{title}</h1>
          <p className="text-sm text-[#c9d1d8]">{body}</p>
          <dl className="mt-2 w-full space-y-1.5 rounded-lg border border-neon/25 bg-[#17191c]/70 p-4 text-left text-sm">
            <div className="flex justify-between"><dt className="text-muted">Order</dt><dd className="font-mono">{order.orderNumber}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Items</dt><dd className="truncate">{order.items.map((i) => `${i.titleSnapshot}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Deliver to</dt><dd>{order.gamePlayerId} · {GAME_LABEL[order.game]}</dd></div>
            {order.gameNickname && <div className="flex justify-between"><dt className="text-muted">Nickname</dt><dd>{order.gameNickname}</dd></div>}
            {order.discount > 0 && <div className="flex justify-between text-success"><dt>Coupon {order.couponCode}</dt><dd>−{formatINR(order.discount)}</dd></div>}
            <div className="flex justify-between border-t border-neon/20 pt-2 font-bold"><dt>{paid ? "Paid" : "Amount"}</dt><dd className="text-neon">{formatINR(order.total)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link href={`/orders/${order.orderNumber}`} className="btn-primary">Track order</Link>
            <Link href="/marketplace" className="btn-outline">Continue shopping</Link>
          </div>
          {pending && <meta httpEquiv="refresh" content="8" />}
        </div>
      </Frame>
    </div>
  );
}
