import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkout } from "@/lib/services/orders";
import { checkoutSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`checkout:${user.id}`, 20, 600);
  const input = await parseBody(req, checkoutSchema);
  return ok(await checkout(user.id, input), 201);
});
