import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getSellerPublic, listProducts } from "@/lib/services/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getSavedIds } from "@/lib/services/user-data";
import { ProductGrid } from "@/components/product/product-card";
import { Stars, VerifiedBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { SectionHeader } from "@/components/ui/section";

export default async function SellerPage(props: PageProps<"/seller/[id]">) {
  const { id } = await props.params;
  const seller = await getSellerPublic(id);
  if (!seller?.seller || seller.seller.status !== "VERIFIED") notFound();
  const user = await getCurrentUser();
  const [listings, saved] = await Promise.all([listProducts({ sellerId: id, pageSize: 24 }), getSavedIds(user?.id)]);
  const s = seller.seller;
  return (
    <div className="space-y-8">
      <div className="card relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-crimson/40 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-neon to-crimson font-display text-3xl font-bold">{s.storeName.slice(0, 1)}</span>
          <div className="flex-1">
            <h1 className="heading flex items-center gap-2 text-3xl">{s.storeName} <VerifiedBadge /></h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
              <Stars value={s.ratingAvg} count={s.ratingCount} /> {s.totalSales} sold
              <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Member since {seller.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
            </p>
            {s.bio && <p className="mt-2 max-w-2xl text-sm text-zinc-300">{s.bio}</p>}
          </div>
        </div>
      </div>
      <section>
        <SectionHeader title={`Listings (${listings.total})`} />
        {listings.items.length ? <ProductGrid items={listings.items} savedIds={saved} /> : <EmptyState title="No active listings" />}
      </section>
      <section>
        <SectionHeader title="Reviews" />
        {seller.reviewsGot.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {seller.reviewsGot.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{r.buyer.name.split(" ")[0]}</span>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p className="mt-2 text-sm text-zinc-300">{r.comment}</p>}
                <p className="mt-2 text-xs text-zinc-500">{r.createdAt.toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No reviews yet.</p>
        )}
      </section>
    </div>
  );
}
