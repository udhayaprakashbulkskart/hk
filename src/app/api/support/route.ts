import { handler, ok, parseBody } from "@/lib/api";
import { clientIp, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ticketSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  await rateLimit(`ticket:${(await clientIp()) ?? "unknown"}`, 5, 3600);
  const user = await getCurrentUser();
  const input = await parseBody(req, ticketSchema);
  const t = await db.supportTicket.create({ data: { ...input, userId: user?.id ?? null } });
  return ok({ id: t.id }, 201);
});
