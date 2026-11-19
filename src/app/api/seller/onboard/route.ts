import { handler } from "@/lib/api";
import { forbidden } from "@/lib/errors";

/** Selling is closed: ZYNOFLIX STORE lists every product itself. */
export const POST = handler(async () => {
  throw forbidden("Selling isn't available. All products are listed by ZYNOFLIX STORE.");
});
