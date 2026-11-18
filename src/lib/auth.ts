import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { forbidden, unauthorized } from "./errors";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "ps_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Creates a DB-backed session and sets an httpOnly cookie holding the raw token. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: await clientIp(),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  avatarUrl: true,
  walletBalance: true,
  gamePlayerId: true,
  preferredGame: true,
  phone: true,
  seller: { select: { id: true, status: true, storeName: true } },
} as const;

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Returns the signed-in user or null. Rejects expired sessions and suspended users. */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: userSelect } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
}

// ── API guards (throw ApiError) ──
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export async function requireVerifiedSeller() {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  if (user.seller?.status !== "VERIFIED") throw forbidden("Your seller account must be verified first");
  return user;
}

// ── Page guards (redirect) ──
export async function pageUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function pageAdmin() {
  const user = await pageUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
