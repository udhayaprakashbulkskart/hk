import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { autoCompleteDelivered, expireStaleOrders } from "@/lib/services/orders";
import { getAutoCompleteDays } from "@/lib/settings";
import { db } from "@/lib/db";

/** Scheduled job (Vercel Cron): expire unpaid orders, auto-complete delivered items, prune sessions. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const expired = await expireStaleOrders();
  const completed = await autoCompleteDelivered(await getAutoCompleteDays());
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return NextResponse.json({ ok: true, expired, completed, prunedSessions: sessions.count });
}
