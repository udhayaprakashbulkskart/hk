import { handler, ok, parseBody } from "@/lib/api";
import { requireVerifiedSeller } from "@/lib/auth";
import { archiveListing, updateListing } from "@/lib/services/products";
import { productSchema } from "@/lib/validation";

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const user = await requireVerifiedSeller();
  const input = await parseBody(req, productSchema);
  const p = await updateListing(user, id, input);
  return ok({ id: p.id, slug: p.slug, status: p.status });
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  const user = await requireVerifiedSeller();
  await archiveListing(user, id);
  return ok({});
});
