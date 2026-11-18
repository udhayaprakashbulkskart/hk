import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { saveLocalUpload } from "@/lib/storage";

/** Local-driver upload (development). Production uses direct Cloudinary uploads via /api/uploads/sign. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 60, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("No file uploaded");
  return ok(await saveLocalUpload(file), 201);
});
