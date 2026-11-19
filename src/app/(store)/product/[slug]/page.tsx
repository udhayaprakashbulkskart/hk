import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Gift, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getProductBySlug, relatedProducts } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { DELIVERY_LABEL, GAME_LABEL, RARITY_LABEL } from "@/lib/constants";
import { ProductGallery } from "@/components/product/gallery";
import { PurchasePanel } from "@/components/product/cart-buttons";
import { WishlistButton } from "@/components/product/wishlist-button";
import { ProductGrid } from "@/components/product/product-card";
import { ReportButton } from "@/components/forms/report-button";
import { Price, RarityBadge, StatusBadge } from "@/components/ui/badges";
import { SectionHeader } from "@/components/ui/section";

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await db.product.findUnique({ where: { slug }, select: { title: true, description: true, status: true } });
  if (!p || p.status !== "APPROVED") return { title: "Item not found" };
  return { title: p.title, description: p.description.slice(0, 160), alternates: { canonical: `/product/${slug}` } };
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const [p, user] = await Promise.all([getProductBySlug(slug), getCurrentUser()]);
  // Non-approved listings are only visible to their seller and admins.
  if (!p || (p.status !== "APPROVED" && p.sellerId !== user?.id && user?.role !== "ADMIN")) notFound();

  const [related, saved] = await Promise.all([relatedProducts(p.id, p.categoryId), getSavedIds(user?.id)]);
  if (p.status === "APPROVED") db.product.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const available = p.status === "APPROVED" && p.stock > 0;
  const isOwn = user?.id === p.sellerId;
  const specs: [string, string][] = [
    ["Game", GAME_LABEL[p.game]],
    ["Category", p.category.name],
    ["Rarity", RARITY_LABEL[p.rarity]],
    ...(p.level ? ([["Level", `Lv. ${p.level}${p.maxLevel ? ` / ${p.maxLevel}${p.level === p.maxLevel ? " (Max)" : ""}` : ""}`]] as [string, string][]) : []),
    ...(p.ucAmount ? ([["UC amount", `${p.ucAmount.toLocaleString("en-IN")} UC`]] as [string, string][]) : []),
    ["Features", p.features.join(", ") || "—"],
    ["Delivery", DELIVERY_LABEL[p.deliveryMethod]],
    ["Availability", available ? `${p.stock} in stock` : "Out of stock"],
  ];

  return (
    <div className="space-y-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/marketplace" className="hover:text-white">Marketplace</Link> / <Link href={`/category/${p.category.slug}`} className="hover:text-white">{p.category.name}</Link> / <span className="text-zinc-300">{p.title}</span>
      </nav>
      {p.status !== "APPROVED" && (
        <div className="card flex items-center gap-3 border-warn/40 p-4 text-sm">
          <StatusBadge status={p.status} /> This listing isn&apos;t public yet. {p.rejectionReason && <span className="text-neon-soft">Reason: {p.rejectionReason}</span>}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery media={p.media} title={p.title} />
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="heading gold-text text-3xl sm:text-4xl">{p.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <RarityBadge rarity={p.rarity} />
                {p.level && p.maxLevel && p.level < p.maxLevel && <span className="badge border-amber-500/40 bg-amber-500/10 text-amber-300">Upgradable</span>}
                {p.features.slice(0, 3).map((f) => (
                  <span key={f} className="badge border-violet-500/40 bg-violet-500/10 text-violet-200"><Sparkles className="size-3" /> {f}</span>
                ))}
              </div>
            </div>
            <WishlistButton productId={p.id} initial={saved.includes(p.id)} className="shrink-0" />
          </div>

          <Price price={p.price} compareAt={p.compareAtPrice} size="lg" />

          <dl className="card divide-y divide-line/60 text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>

          {isOwn ? (
            <Link href={`/admin/products/${p.id}/edit`} className="btn-outline w-full py-3">Edit product (admin)</Link>
          ) : (
            <PurchasePanel productId={p.id} stock={p.stock} disabled={!available} />
          )}

          <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
            <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-neon" /> Secure payment</p>
            <p className="flex items-center gap-2"><Gift className="size-4 text-neon" /> Player ID only</p>
            <p className="flex items-center gap-2"><PackageCheck className="size-4 text-neon" /> Refund if not delivered</p>
          </div>

          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-neon/60 bg-[#30353b] text-neon"><BadgeCheck className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Sold &amp; delivered by ZYNOFLIX STORE</p>
              <p className="mt-0.5 text-xs text-muted">Official store listing · delivered to your Player ID through the game&apos;s own gifting or redeem system.</p>
            </div>
          </div>

          <section>
            <h2 className="heading mb-2 text-lg">Description</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-300">{p.description}</p>
          </section>
          {!isOwn && user && <ReportButton productId={p.id} />}
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <SectionHeader kicker="You may also like" title="Related items" href={`/category/${p.category.slug}`} />
          <ProductGrid items={related} savedIds={saved} />
        </section>
      )}
    </div>
  );
}
