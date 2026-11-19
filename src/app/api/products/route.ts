import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { listProducts, parseFilters } from "@/lib/services/catalog";
import { createListing } from "@/lib/services/products";
import { productSchema } from "@/lib/validation";

export const GET = handler(async (req) => {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await listProducts(parseFilters(sp)));
});

export const POST = handler(async (req) => {
  const user = await requireRole("ADMIN");
  const input = await parseBody(req, productSchema);
  const product = await createListing(user, input);
  return ok({ id: product.id, slug: product.slug, status: product.status }, 201);
});
