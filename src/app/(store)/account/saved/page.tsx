import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { productCardSelect } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Saved Items" };

export default async function SavedPage() {
  const user = await pageUser("/account/saved");
  const rows = await db.wishlistItem.findMany({ where: { userId: user.id, product: { status: "APPROVED" } }, orderBy: { createdAt: "desc" }, select: { product: { select: productCardSelect } } });
  const items = rows.map((r) => r.product);
  return (
    <div>
      <PageTitle title="Saved Items" subtitle="Your wishlist." />
      {items.length ? <ProductGrid items={items} savedIds={items.map((i) => i.id)} /> : <EmptyState title="Nothing saved yet" body="Tap the heart on any item to save it here." action={{ href: "/skins", label: "Browse skins" }} />}
    </div>
  );
}
