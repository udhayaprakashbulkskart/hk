import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toPaise } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { createWalletTopup } from "@/lib/services/orders";
import { topupSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`topup:${user.id}`, 10, 600);
  const { amount } = await parseBody(req, topupSchema);
  return ok(await createWalletTopup(user.id, toPaise(amount)), 201);
});
