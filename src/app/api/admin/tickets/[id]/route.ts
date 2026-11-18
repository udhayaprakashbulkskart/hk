import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit, notify } from "@/lib/audit";

const schema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]), adminReply: z.string().trim().max(2000).optional() });

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, schema);
  const t = await db.supportTicket.update({ where: { id }, data: input });
  if (t.userId && input.adminReply) await notify(t.userId, `Support: ${t.subject}`, input.adminReply.slice(0, 200), "/support");
  await audit(admin.id, "admin.ticket.update", "SupportTicket", id, { status: input.status });
  return ok({});
});
