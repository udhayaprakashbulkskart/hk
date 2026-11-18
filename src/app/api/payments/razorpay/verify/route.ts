import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, notFound } from "@/lib/errors";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { finalizeRazorpayPayment } from "@/lib/services/orders";
import { razorpayVerifySchema } from "@/lib/validation";

/**
 * Called by the browser after Razorpay Checkout returns. The signature is verified with the
 * server-side secret and the payment is re-fetched from Razorpay before anything is marked paid.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, razorpayVerifySchema);
  const payment = await db.payment.findUnique({
    where: { razorpayOrderId: body.razorpay_order_id },
    include: { order: { select: { buyerId: true, orderNumber: true } }, topup: { select: { userId: true } } },
  });
  const owner = payment?.order?.buyerId ?? payment?.topup?.userId;
  if (!payment || owner !== user.id) throw notFound("Payment not found");
  if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    throw new ApiError(400, "Payment signature verification failed");
  }
  await finalizeRazorpayPayment(body.razorpay_order_id, body.razorpay_payment_id, "checkout");
  return ok({ orderNumber: payment.order?.orderNumber ?? null });
});
