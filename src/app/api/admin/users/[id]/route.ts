import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { destroyAllSessions, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { audit, notify } from "@/lib/audit";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), role: z.enum(["USER", "SELLER", "ADMIN"]).optional() });

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, schema);
  if (id === admin.id) throw badRequest("You can't change your own role or status");
  const user = await db.user.update({ where: { id }, data: input });
  if (input.status === "SUSPENDED") {
    await destroyAllSessions(id);
    await db.product.updateMany({ where: { sellerId: id, status: "APPROVED" }, data: { status: "ARCHIVED" } });
  }
  if (input.status) await notify(id, input.status === "SUSPENDED" ? "Account suspended" : "Account reactivated", "Contact support if you have questions.");
  await audit(admin.id, "admin.user.update", "User", id, input);
  return ok({ id: user.id });
});
