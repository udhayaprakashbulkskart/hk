import "server-only";
import { randomBytes } from "node:crypto";
import { db, type Tx } from "../db";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../errors";
import { commissionFor } from "../money";
import { getCommissionBps } from "../settings";
import { audit, notify } from "../audit";
import { creditWallet, debitWallet } from "../wallet";
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  publicKeyId,
  razorpayConfigured,
  refundRazorpayPayment,
} from "../razorpay";
import type { Game } from "@/generated/prisma/enums";
import { allocate, evaluateCoupon, releaseCoupon, reserveCoupon } from "./coupons";

const PENDING_ORDER_TTL_MIN = 30;

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `PS-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

type Line = { productId: string; quantity: number };

export type CheckoutInput = {
  provider: "RAZORPAY" | "WALLET";
  gamePlayerId: string;
  game: Exclude<Game, "BOTH">;
  productId?: string;
  quantity?: number;
  couponCode?: string;
  gameNickname?: string;
};

export type CheckoutResult =
  | { kind: "paid"; orderNumber: string }
  | { kind: "razorpay"; orderNumber: string; keyId: string; razorpayOrderId: string; amount: number; currency: string };

/**
 * Creates an order and reserves stock atomically.
 * - WALLET: debits the wallet inside the same transaction → order is PAID immediately.
 * - RAZORPAY: order stays PENDING_PAYMENT until a verified signature or webhook marks it paid.
 */
export async function checkout(userId: string, input: CheckoutInput): Promise<CheckoutResult> {
  if (input.provider === "RAZORPAY" && !razorpayConfigured()) {
    throw new ApiError(503, "Online payments are not configured yet. Please pay with your wallet balance.");
  }
  await expireStaleOrders();

  let lines: Line[];
  if (input.productId) {
    lines = [{ productId: input.productId, quantity: input.quantity ?? 1 }];
  } else {
    const cart = await db.cartItem.findMany({ where: { userId } });
    if (!cart.length) throw badRequest("Your cart is empty");
    lines = cart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
  }

  const rateBps = await getCommissionBps();
  const orderNumber = newOrderNumber();

  const order = await db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) } },
      select: { id: true, title: true, price: true, stock: true, status: true, sellerId: true, game: true, isOfficialStore: true },
    });
    const items = lines.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p || p.status !== "APPROVED") throw badRequest("An item in your order is no longer available");
      if (p.sellerId === userId) throw badRequest("You can't buy your own listing");
      if (p.game !== "BOTH" && p.game !== input.game) throw badRequest(`"${p.title}" is only available for ${p.game === "BGMI" ? "BGMI" : "PUBG Mobile"}`);
      const lineTotal = p.price * l.quantity;
      const commission = commissionFor(lineTotal, rateBps);
      return { p, quantity: l.quantity, lineTotal, commission };
    });

    // Reserve stock with conditional decrements so concurrent buyers can't oversell.
    for (const it of items) {
      const r = await tx.product.updateMany({ where: { id: it.p.id, stock: { gte: it.quantity }, status: "APPROVED" }, data: { stock: { decrement: it.quantity } } });
      if (r.count !== 1) throw conflict(`"${it.p.title}" just went out of stock`);
    }

    // UC is credited by in-game name + ID match, so a nickname is mandatory for top-ups.
    if (items.some((i) => i.p.isOfficialStore) && !input.gameNickname) {
      throw badRequest("Enter your in-game nickname for UC top-ups", { gameNickname: "Required for UC top-up" });
    }

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const commissionTotal = items.reduce((s, i) => s + i.commission, 0);
    // Coupons are platform-funded: the buyer pays less, seller earnings are unchanged.
    const promo = input.couponCode ? await evaluateCoupon(tx, input.couponCode, userId, subtotal) : null;
    const discount = promo?.discount ?? 0;
    if (promo) await reserveCoupon(tx, promo.coupon.id, promo.coupon.usageLimit);
    const shares = allocate(discount, items.map((i) => i.lineTotal));
    const total = subtotal - discount;
    const created = await tx.order.create({
      data: {
        orderNumber,
        buyerId: userId,
        subtotal,
        discount,
        couponCode: promo?.coupon.code ?? null,
        platformFee: commissionTotal - discount,
        total,
        provider: input.provider,
        gamePlayerId: input.gamePlayerId,
        gameNickname: input.gameNickname || null,
        game: input.game,
        items: {
          create: items.map((i, k) => ({
            discount: shares[k],
            productId: i.p.id,
            sellerId: i.p.sellerId,
            titleSnapshot: i.p.title,
            unitPrice: i.p.price,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
            commissionRateBps: rateBps,
            commission: i.commission,
            sellerEarning: i.lineTotal - i.commission,
          })),
        },
      },
    });

    if (promo) await tx.couponRedemption.create({ data: { couponId: promo.coupon.id, userId, orderId: created.id, amount: discount } });

    if (input.provider === "WALLET") {
      await debitWallet(tx, userId, total, "PURCHASE", orderNumber, `Payment for order ${orderNumber}`);
      await tx.payment.create({ data: { orderId: created.id, provider: "WALLET", amount: total, status: "CAPTURED", method: "wallet" } });
      await markOrderPaidTx(tx, created.id);
    }
    return created;
  });

  if (input.provider === "WALLET") {
    await audit(userId, "order.paid", "Order", order.id, { provider: "WALLET", total: order.total });
    return { kind: "paid", orderNumber };
  }

  // Razorpay: create a gateway order outside the DB transaction.
  try {
    const rzp = await createRazorpayOrder(order.total, orderNumber, { orderNumber });
    await db.payment.create({ data: { orderId: order.id, provider: "RAZORPAY", amount: order.total, razorpayOrderId: rzp.id } });
    return { kind: "razorpay", orderNumber, keyId: publicKeyId(), razorpayOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency };
  } catch (err) {
    await cancelOrder(order.id, "Payment gateway unavailable");
    throw err;
  }
}

/** Moves a PENDING_PAYMENT order to PAID and notifies sellers. Idempotent. */
async function markOrderPaidTx(tx: Tx, orderId: string) {
  const r = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "PAID", paidAt: new Date() } });
  if (r.count !== 1) return false;
  await tx.orderItem.updateMany({ where: { orderId }, data: { status: "PROCESSING" } });
  const items = await tx.orderItem.findMany({ where: { orderId }, include: { order: { select: { orderNumber: true, buyerId: true } } } });
  for (const it of items) {
    await tx.product.update({ where: { id: it.productId }, data: { salesCount: { increment: it.quantity } } });
    await notify(it.sellerId, "New sale 🎉", `You sold "${it.titleSnapshot}". Deliver it to the buyer's Player ID.`, `/account/sales`, tx);
  }
  if (items[0]) await tx.cartItem.deleteMany({ where: { userId: items[0].order.buyerId, productId: { in: items.map((i) => i.productId) } } });
  if (items[0]) await notify(items[0].order.buyerId, "Payment received", `Order ${items[0].order.orderNumber} is confirmed.`, `/orders/${items[0].order.orderNumber}`, tx);
  return true;
}

/** Cancels an unpaid order and releases reserved stock. */
export async function cancelOrder(orderId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    if (r.count !== 1) return;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const it of items) await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
    await tx.orderItem.updateMany({ where: { orderId }, data: { status: "CANCELLED" } });
    await tx.payment.updateMany({ where: { orderId, status: "CREATED" }, data: { status: "FAILED", failureReason: reason } });
    await releaseCoupon(tx, orderId);
  });
}

/** Releases stock held by unpaid orders older than the TTL. */
export async function expireStaleOrders() {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(Date.now() - PENDING_ORDER_TTL_MIN * 60_000) } },
    select: { id: true },
    take: 50,
  });
  for (const o of stale) await cancelOrder(o.id, "Payment window expired");
  return stale.length;
}

/**
 * Finalises a Razorpay payment after the checkout signature or webhook has been verified.
 * Re-fetches the payment from Razorpay to confirm status and amount — the browser is never
 * trusted to declare success.
 */
export async function finalizeRazorpayPayment(razorpayOrderId: string, razorpayPaymentId: string, source: "checkout" | "webhook") {
  const payment = await db.payment.findUnique({ where: { razorpayOrderId }, include: { order: true, topup: true } });
  if (!payment) throw notFound("Payment not found");
  if (payment.status === "CAPTURED") return payment; // idempotent

  let rp = await fetchRazorpayPayment(razorpayPaymentId);
  if (rp.order_id !== razorpayOrderId) throw badRequest("Payment does not belong to this order");
  if (rp.amount !== payment.amount || rp.currency !== "INR") throw badRequest("Payment amount mismatch");
  if (rp.status === "authorized") rp = await captureRazorpayPayment(rp.id, payment.amount);
  if (rp.status !== "captured") {
    if (rp.status === "failed") await markRazorpayFailed(razorpayOrderId, rp.error_description ?? "Payment failed");
    throw new ApiError(402, "Payment was not completed");
  }

  let lateOrder = false;
  await db.$transaction(async (tx) => {
    const upd = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "CAPTURED" } },
      data: { status: "CAPTURED", razorpayPaymentId: rp.id, method: rp.method ?? null },
    });
    if (upd.count !== 1) return; // processed concurrently
    if (payment.orderId) {
      const paid = await markOrderPaidTx(tx, payment.orderId);
      if (!paid) {
        // Order was cancelled (e.g. expired) before payment landed — refund to wallet.
        const ord = payment.order!;
        if (ord.status === "CANCELLED") {
          lateOrder = true;
          await creditWallet(tx, ord.buyerId, payment.amount, "REFUND", ord.orderNumber, "Late payment on expired order");
          await notify(ord.buyerId, "Payment refunded to wallet", `Order ${ord.orderNumber} had expired, so we credited ₹${payment.amount / 100} to your wallet.`, "/wallet", tx);
        }
      }
    } else if (payment.topupId && payment.topup) {
      await tx.walletTopup.update({ where: { id: payment.topupId }, data: { status: "CAPTURED" } });
      await creditWallet(tx, payment.topup.userId, payment.amount, "TOPUP", rp.id, "Wallet top-up via Razorpay");
    }
  });
  await audit(null, lateOrder ? "payment.late_refunded" : "payment.captured", "Payment", payment.id, { source, razorpayPaymentId: rp.id });
  return payment;
}

export async function markRazorpayFailed(razorpayOrderId: string, reason: string) {
  const payment = await db.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment || payment.status === "CAPTURED") return;
  await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason.slice(0, 250) } });
  // Keep the order open (buyer may retry within the TTL); it expires automatically otherwise.
}

export async function createWalletTopup(userId: string, amount: number) {
  const topup = await db.walletTopup.create({ data: { userId, amount } });
  const rzp = await createRazorpayOrder(amount, `TOPUP-${topup.id.slice(-10)}`, { topupId: topup.id });
  await db.payment.create({ data: { topupId: topup.id, provider: "RAZORPAY", amount, razorpayOrderId: rzp.id } });
  return { keyId: publicKeyId(), razorpayOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency };
}

// ───────────────────────── Fulfillment ─────────────────────────

export async function markDelivered(sellerId: string, orderItemId: string, deliveryNote: string, isAdmin = false) {
  const item = await db.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
  if (!item) throw notFound("Order item not found");
  if (!isAdmin && item.sellerId !== sellerId) throw forbidden();
  if (item.status !== "PROCESSING") throw conflict("Only paid, undelivered items can be marked delivered");
  await db.orderItem.update({ where: { id: item.id }, data: { status: "DELIVERED", deliveredAt: new Date(), deliveryNote } });
  await notify(item.order.buyerId, "Item delivered", `"${item.titleSnapshot}" was sent to Player ID ${item.order.gamePlayerId}. Please confirm receipt.`, `/orders/${item.order.orderNumber}`);
  await audit(sellerId, "orderItem.delivered", "OrderItem", item.id);
}

/** Buyer confirms receipt (or auto-completion) → seller earning moves to their wallet. */
export async function completeItem(orderItemId: string, actor: { id: string; isAdmin?: boolean } | null) {
  const done = await db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
    if (!item) throw notFound("Order item not found");
    if (actor && !actor.isAdmin && item.order.buyerId !== actor.id) throw forbidden();
    if (item.status !== "DELIVERED") throw conflict("Only delivered items can be completed");
    const r = await tx.orderItem.updateMany({ where: { id: item.id, status: "DELIVERED", earningCredited: false }, data: { status: "COMPLETED", completedAt: new Date(), earningCredited: true } });
    if (r.count !== 1) return null;
    if (item.sellerEarning > 0) await creditWallet(tx, item.sellerId, item.sellerEarning, "SALE_EARNING", item.order.orderNumber, `Earning for "${item.titleSnapshot}"`);
    await tx.sellerProfile.updateMany({ where: { userId: item.sellerId }, data: { totalSales: { increment: item.quantity } } });
    await notify(item.sellerId, "Earnings released", `₹${item.sellerEarning / 100} for "${item.titleSnapshot}" is now in your wallet.`, "/wallet", tx);
    await syncOrderStatus(tx, item.orderId);
    return item;
  });
  if (done) await audit(actor?.id ?? null, "orderItem.completed", "OrderItem", orderItemId, { auto: !actor });
  return done;
}

async function syncOrderStatus(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
  const all = (s: string[]) => items.every((i) => s.includes(i.status));
  const anyRefunded = items.some((i) => i.status === "REFUNDED");
  let status: "COMPLETED" | "REFUNDED" | "PARTIALLY_REFUNDED" | null = null;
  if (all(["REFUNDED"])) status = "REFUNDED";
  else if (all(["COMPLETED", "REFUNDED"])) status = anyRefunded ? "PARTIALLY_REFUNDED" : "COMPLETED";
  else if (anyRefunded) status = "PARTIALLY_REFUNDED";
  if (status) await tx.order.update({ where: { id: orderId }, data: { status } });
}

export async function autoCompleteDelivered(days: number) {
  const items = await db.orderItem.findMany({
    where: { status: "DELIVERED", deliveredAt: { lt: new Date(Date.now() - days * 86_400_000) } },
    select: { id: true },
    take: 100,
  });
  for (const i of items) await completeItem(i.id, null).catch((e) => console.error("[auto-complete]", i.id, e));
  return items.length;
}

// ───────────────────────── Refunds ─────────────────────────

export async function requestRefund(userId: string, orderItemId: string, reason: string) {
  const item = await db.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
  if (!item || item.order.buyerId !== userId) throw notFound("Order item not found");
  if (!["PROCESSING", "DELIVERED"].includes(item.status)) throw conflict("A refund can only be requested before you confirm receipt");
  return db.$transaction(async (tx) => {
    await tx.orderItem.update({ where: { id: item.id }, data: { status: "REFUND_REQUESTED" } });
    const refund = await tx.refund.create({
      data: {
        orderId: item.orderId,
        orderItemId: item.id,
        requesterId: userId,
        amount: item.lineTotal - item.discount, // refund what was actually paid for this line
        reason,
        destination: item.order.provider === "RAZORPAY" ? "ORIGINAL" : "WALLET",
      },
    });
    await notify(item.sellerId, "Refund requested", `The buyer requested a refund for "${item.titleSnapshot}". An admin will review it.`, "/account/sales", tx);
    await audit(userId, "refund.requested", "Refund", refund.id, { orderItemId }, tx);
    return refund;
  });
}

export async function decideRefund(adminId: string, refundId: string, approve: boolean, adminNote?: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId }, include: { orderItem: true, order: { include: { payments: true } } } });
  if (!refund) throw notFound("Refund not found");
  if (refund.status !== "REQUESTED") throw conflict("This refund has already been decided");

  if (!approve) {
    await db.$transaction(async (tx) => {
      await tx.refund.update({ where: { id: refund.id }, data: { status: "REJECTED", adminNote, processedAt: new Date() } });
      await tx.orderItem.update({ where: { id: refund.orderItemId }, data: { status: refund.orderItem.deliveredAt ? "DELIVERED" : "PROCESSING" } });
      await notify(refund.requesterId, "Refund declined", adminNote || "Your refund request was declined after review.", `/orders/${refund.order.orderNumber}`, tx);
      await audit(adminId, "refund.rejected", "Refund", refund.id, { adminNote }, tx);
    });
    return;
  }

  // Gateway refund first (outside the DB transaction); fall back to wallet when not possible.
  let destination = refund.destination;
  let providerRef: string | null = null;
  const rzpPayment = refund.order.payments.find((p) => p.provider === "RAZORPAY" && p.status === "CAPTURED" && p.razorpayPaymentId);
  if (destination === "ORIGINAL" && rzpPayment && razorpayConfigured()) {
    const r = await refundRazorpayPayment(rzpPayment.razorpayPaymentId!, refund.amount, { refundId: refund.id });
    providerRef = r.id;
  } else {
    destination = "WALLET";
  }

  await db.$transaction(async (tx) => {
    const r = await tx.refund.updateMany({ where: { id: refund.id, status: "REQUESTED" }, data: { status: "PROCESSED", destination, providerRef, adminNote, processedAt: new Date() } });
    if (r.count !== 1) throw conflict("This refund has already been decided");
    if (destination === "WALLET") await creditWallet(tx, refund.requesterId, refund.amount, "REFUND", refund.order.orderNumber, `Refund for "${refund.orderItem.titleSnapshot}"`);
    await tx.orderItem.update({ where: { id: refund.orderItemId }, data: { status: "REFUNDED" } });
    await syncOrderStatus(tx, refund.orderId);
    await notify(
      refund.requesterId,
      "Refund approved",
      destination === "WALLET" ? `₹${refund.amount / 100} was credited to your wallet.` : `₹${refund.amount / 100} is being returned to your original payment method (5–7 working days).`,
      `/orders/${refund.order.orderNumber}`,
      tx,
    );
    await notify(refund.orderItem.sellerId, "Refund issued", `"${refund.orderItem.titleSnapshot}" was refunded to the buyer.`, "/account/sales", tx);
    await audit(adminId, "refund.processed", "Refund", refund.id, { destination, providerRef, amount: refund.amount }, tx);
  });
}

// ───────────────────────── Withdrawals ─────────────────────────

export async function requestWithdrawal(userId: string, amount: number, upiId: string) {
  return db.$transaction(async (tx) => {
    const pending = await tx.withdrawal.count({ where: { userId, status: { in: ["PENDING", "APPROVED"] } } });
    if (pending >= 3) throw conflict("You already have 3 withdrawals in progress");
    const w = await tx.withdrawal.create({ data: { userId, amount, upiId } });
    await debitWallet(tx, userId, amount, "WITHDRAWAL", w.id, `Withdrawal to ${upiId}`);
    await audit(userId, "withdrawal.requested", "Withdrawal", w.id, { amount }, tx);
    return w;
  });
}

export async function decideWithdrawal(adminId: string, id: string, action: "approve" | "paid" | "reject", note?: string, payoutRef?: string) {
  await db.$transaction(async (tx) => {
    const w = await tx.withdrawal.findUnique({ where: { id } });
    if (!w) throw notFound("Withdrawal not found");
    if (action === "approve") {
      if (w.status !== "PENDING") throw conflict("Withdrawal is not pending");
      await tx.withdrawal.update({ where: { id }, data: { status: "APPROVED", adminNote: note } });
    } else if (action === "paid") {
      if (!["PENDING", "APPROVED"].includes(w.status)) throw conflict("Withdrawal can't be marked paid");
      if (!payoutRef) throw badRequest("Payout reference (UTR) is required");
      await tx.withdrawal.update({ where: { id }, data: { status: "PAID", payoutRef, adminNote: note, processedAt: new Date() } });
      await notify(w.userId, "Withdrawal paid", `₹${w.amount / 100} was sent to ${w.upiId}. Ref: ${payoutRef}`, "/wallet", tx);
    } else {
      if (!["PENDING", "APPROVED"].includes(w.status)) throw conflict("Withdrawal can't be rejected");
      await tx.withdrawal.update({ where: { id }, data: { status: "REJECTED", adminNote: note, processedAt: new Date() } });
      await creditWallet(tx, w.userId, w.amount, "WITHDRAWAL_REVERSAL", w.id, "Withdrawal rejected — funds returned");
      await notify(w.userId, "Withdrawal rejected", note || "Your withdrawal was rejected and the amount returned to your wallet.", "/wallet", tx);
    }
    await audit(adminId, `withdrawal.${action}`, "Withdrawal", id, { note, payoutRef }, tx);
  });
}

// ───────────────────────── Reviews ─────────────────────────

export async function leaveReview(buyerId: string, orderItemId: string, rating: number, comment?: string) {
  const item = await db.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true, review: true } });
  if (!item || item.order.buyerId !== buyerId) throw notFound("Order item not found");
  if (item.status !== "COMPLETED") throw conflict("You can review an item after confirming receipt");
  if (item.review) throw conflict("You already reviewed this item");
  await db.$transaction(async (tx) => {
    await tx.review.create({ data: { orderItemId, buyerId, sellerId: item.sellerId, rating, comment } });
    const agg = await tx.review.aggregate({ where: { sellerId: item.sellerId }, _avg: { rating: true }, _count: true });
    await tx.sellerProfile.updateMany({ where: { userId: item.sellerId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  });
}
