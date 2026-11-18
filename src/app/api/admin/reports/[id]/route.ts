import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]), note: z.string().trim().max(300).optional(), takeDown: z.boolean().default(false) });

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, schema);
  const report = await db.report.update({ where: { id }, data: { status: input.status, adminNote: input.note } });
  if (input.takeDown) {
    await db.product.update({ where: { id: report.productId }, data: { status: "REJECTED", rejectionReason: `Removed after report: ${report.reason}`, isFeatured: false } });
    await db.cartItem.deleteMany({ where: { productId: report.productId } });
  }
  await audit(admin.id, "admin.report.decide", "Report", id, input);
  return ok({});
});
