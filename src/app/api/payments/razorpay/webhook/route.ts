import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { finalizeRazorpayPayment, markRazorpayFailed } from "@/lib/services/orders";
import { audit } from "@/lib/audit";

type Event = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; status: string } };
  };
};

/** Razorpay webhook: source of truth for payment state, even if the browser closes mid-checkout. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  let evt: Event;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  try {
    const pay = evt.payload.payment?.entity;
    switch (evt.event) {
      case "payment.captured":
      case "order.paid":
        if (pay) await finalizeRazorpayPayment(pay.order_id, pay.id, "webhook");
        break;
      case "payment.failed":
        if (pay) await markRazorpayFailed(pay.order_id, pay.error_description ?? "Payment failed");
        break;
      case "refund.processed":
      case "refund.failed": {
        const ref = evt.payload.refund?.entity;
        if (ref) await audit(null, `razorpay.${evt.event}`, "Refund", null, { refundId: ref.id, paymentId: ref.payment_id });
        break;
      }
    }
    if (pay) await db.payment.updateMany({ where: { razorpayOrderId: pay.order_id }, data: { rawEvent: evt as object } });
  } catch (err) {
    // Unknown orders (e.g. from another environment) are acknowledged so Razorpay stops retrying.
    console.error("[razorpay webhook]", evt.event, err);
    if (err instanceof Error && /not found/i.test(err.message)) return NextResponse.json({ ok: true, ignored: true });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
