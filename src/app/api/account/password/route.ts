import { handler, ok, parseBody } from "@/lib/api";
import { createSession, destroyAllSessions, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { changePasswordSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, changePasswordSchema);
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(input.currentPassword, full.passwordHash))) throw badRequest("Current password is incorrect", { currentPassword: "Incorrect password" });
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  // Sign out every other device, then issue a fresh session for this one.
  await destroyAllSessions(user.id);
  await createSession(user.id);
  await audit(user.id, "user.password_changed", "User", user.id);
  return ok({});
});
