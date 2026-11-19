import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { productCardSelect } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const user = await pageUser("/wishlist");
  const rows = await db.wishlistItem.findMany({ where: { userId: user.id, product: { status: "APPROVED" } }, orderBy: { createdAt: "desc" }, select: { product: { select: productCardSelect } } });
  const items = rows.map((r) => r.product);
  return (
    <div>
      <PageTitle title="Wishlist" subtitle={items.length ? `${items.length} saved item${items.length === 1 ? "" : "s"}` : "Items you save appear here."} />
      {items.length ? <ProductGrid items={items} savedIds={items.map((i) => i.id)} /> : <EmptyState title="Your wishlist is empty" body="Tap the heart on any item to save it for later." action={{ href: "/marketplace", label: "Browse products" }} />}
    </div>
  );
}
