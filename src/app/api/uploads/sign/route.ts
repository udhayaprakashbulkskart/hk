import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cloudinarySignature, storageDriver } from "@/lib/storage";

export const GET = handler(async () => {
  await requireUser();
  const driver = storageDriver();
  if (driver === "vercel-blob") return ok({ driver });
  if (driver !== "cloudinary") return ok({ driver: "local" as const });
  return ok({ driver: "cloudinary" as const, ...cloudinarySignature() });
});
