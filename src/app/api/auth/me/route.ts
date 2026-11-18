import { handler, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const GET = handler(async () => ok(await getCurrentUser()));
