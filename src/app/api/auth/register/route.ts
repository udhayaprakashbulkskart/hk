import { handler, ok, parseBody } from "@/lib/api";
import { clientIp, createSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  await rateLimit(`register:${(await clientIp()) ?? "unknown"}`, 10, 3600);
  const input = await parseBody(req, registerSchema);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict("An account with this email already exists");
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password) },
  });
  await createSession(user.id);
  await audit(user.id, "user.registered", "User", user.id);
  return ok({ id: user.id }, 201);
});
