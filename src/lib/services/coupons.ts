import "server-only";
import type { Tx } from "../db";
import { db } from "../db";
import { badRequest } from "../errors";
import type { CouponType } from "@/generated/prisma/enums";

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

type CouponLike = { type: CouponType; value: number; maxDiscount: number | null };

/** Pure discount maths (paise). Always leaves at least ₹1 payable. */
export function discountFor(c: CouponLike, subtotal: number) {
  const raw = c.type === "PERCENT" ? Math.floor((subtotal * c.value) / 100) : c.value;
  const capped = c.type === "PERCENT" && c.maxDiscount != null ? Math.min(raw, c.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal - 100));
}

/** Splits an order discount across lines proportionally; rounding remainder goes to the largest line. */
export function allocate(discount: number, lineTotals: number[]) {
  const subtotal = lineTotals.reduce((s, n) => s + n, 0);
  if (!discount || !subtotal) return lineTotals.map(() => 0);
  const parts = lineTotals.map((t) => Math.floor((discount * t) / subtotal));
  const rest = discount - parts.reduce((s, n) => s + n, 0);
  const biggest = lineTotals.indexOf(Math.max(...lineTotals));
  parts[biggest] += rest;
  return parts;
}

/** Validates a code for this user and subtotal. Throws a field error on `couponCode` when unusable. */
export async function evaluateCoupon(client: Tx | typeof db, rawCode: string, userId: string, subtotal: number) {
  const code = normalizeCode(rawCode);
  const coupon = await client.coupon.findUnique({ where: { code } });
  const fail = (msg: string) => badRequest(msg, { couponCode: msg });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw fail("This coupon code isn't valid");
  if (coupon.startsAt && coupon.startsAt > now) throw fail("This coupon isn't active yet");
  if (coupon.endsAt && coupon.endsAt < now) throw fail("This coupon has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw fail("This coupon has been fully redeemed");
  if (subtotal < coupon.minOrder) throw fail(`Add ₹${((coupon.minOrder - subtotal) / 100).toLocaleString("en-IN")} more to use this coupon`);
  const used = await client.couponRedemption.count({ where: { couponId: coupon.id, userId } });
  if (used >= coupon.perUserLimit) throw fail("You've already used this coupon");
  const discount = discountFor(coupon, subtotal);
  if (discount <= 0) throw fail("This coupon doesn't apply to this order");
  return { coupon, discount };
}

/** Reserves one use of the coupon inside the checkout transaction (race-safe against usageLimit). */
export async function reserveCoupon(tx: Tx, couponId: string, usageLimit: number | null) {
  const r = await tx.coupon.updateMany({
    where: { id: couponId, ...(usageLimit != null ? { usedCount: { lt: usageLimit } } : {}) },
    data: { usedCount: { increment: 1 } },
  });
  if (r.count !== 1) throw badRequest("This coupon has just been fully redeemed", { couponCode: "Fully redeemed" });
}

/** Frees the coupon use when an unpaid order is cancelled or expires. */
export async function releaseCoupon(tx: Tx, orderId: string) {
  const red = await tx.couponRedemption.findUnique({ where: { orderId } });
  if (!red) return;
  await tx.couponRedemption.delete({ where: { id: red.id } });
  await tx.coupon.updateMany({ where: { id: red.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
}
