import { handler, ok, parseBody } from "@/lib/api";
import { clientIp, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

// Constant-cost dummy hash so unknown emails take as long as wrong passwords.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password-0"));

export const POST = handler(async (req) => {
  const input = await parseBody(req, loginSchema);
  const ip = (await clientIp()) ?? "unknown";
  await rateLimit(`login:ip:${ip}`, 30, 900);
  await rateLimit(`login:email:${input.email}`, 8, 900);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw new ApiError(401, "Incorrect email or password");
  if (user.status !== "ACTIVE") throw new ApiError(403, "This account is suspended. Contact support.");
  await createSession(user.id);
  await audit(user.id, "user.login", "User", user.id, { ip });
  return ok({ id: user.id, role: user.role });
});
