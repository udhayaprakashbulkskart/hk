import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { sellerOnboardSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

/** Submits (or re-submits after rejection) a seller application for admin verification. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, sellerOnboardSchema);
  const existing = await db.sellerProfile.findUnique({ where: { userId: user.id } });
  if (existing && existing.status !== "REJECTED") throw conflict("You've already applied to sell");
  const taken = await db.sellerProfile.findFirst({ where: { storeName: { equals: input.storeName, mode: "insensitive" }, userId: { not: user.id } } });
  if (taken) throw conflict("That store name is taken");
  const data = {
    storeName: input.storeName,
    legalName: input.legalName,
    panLast4: input.panLast4.toUpperCase(),
    payoutUpi: input.payoutUpi,
    bio: input.bio || null,
    status: "PENDING" as const,
    rejectionReason: null,
  };
  await db.sellerProfile.upsert({ where: { userId: user.id }, update: data, create: { ...data, userId: user.id } });
  await audit(user.id, "seller.applied", "User", user.id);
  return ok({ status: "PENDING" }, 201);
});
