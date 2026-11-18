import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { audit, notify } from "@/lib/audit";

const schema = z.object({ action: z.enum(["verify", "reject"]), reason: z.string().trim().max(300).optional() });

/** [id] is the seller's user id. */
export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const { action, reason } = await parseBody(req, schema);
  const profile = await db.sellerProfile.findUnique({ where: { userId: id } });
  if (!profile) throw notFound("Seller application not found");
  if (action === "verify") {
    await db.$transaction([
      db.sellerProfile.update({ where: { userId: id }, data: { status: "VERIFIED", verifiedAt: new Date(), rejectionReason: null } }),
      db.user.updateMany({ where: { id, role: "USER" }, data: { role: "SELLER" } }),
    ]);
    await notify(id, "You're a verified seller ✅", "You can now list items for sale.", "/sell");
  } else {
    if (!reason) throw badRequest("Reason is required", { reason: "Required" });
    await db.sellerProfile.update({ where: { userId: id }, data: { status: "REJECTED", rejectionReason: reason } });
    await notify(id, "Seller application declined", reason, "/sell");
  }
  await audit(admin.id, `admin.seller.${action}`, "User", id, reason ? { reason } : undefined);
  return ok({});
});
