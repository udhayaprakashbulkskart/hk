import Link from "next/link";
import type { ProductCardData } from "@/lib/services/catalog";
import { GAME_LABEL } from "@/lib/constants";
import { Price, RarityBadge, VerifiedBadge } from "@/components/ui/badges";
import { MediaImage } from "./media-image";
import { WishlistButton } from "./wishlist-button";
import { AddToCartButton } from "./cart-buttons";

export function ProductCard({ p, saved = false, priority }: { p: ProductCardData; saved?: boolean; priority?: boolean }) {
  const img = p.media[0]?.url ?? "/art/rifle-1.svg";
  const store = p.seller.seller;
  return (
    <Link href={`/product/${p.slug}`} className="group card-glow relative flex flex-col overflow-hidden animate-fade-up">
      <div className="relative aspect-[4/3] overflow-hidden bg-black">
        <MediaImage src={img} alt={p.media[0]?.alt ?? p.title} priority={priority} className="object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute top-2 left-2">
          <RarityBadge rarity={p.rarity} />
        </div>
        <WishlistButton productId={p.id} initial={saved} className="absolute top-2 right-2" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">{p.title}</h3>
        <p className="line-clamp-1 text-xs text-muted">
          {p.level ? `Lv.${p.level}${p.maxLevel ? `/${p.maxLevel}` : ""} · ` : ""}
          {GAME_LABEL[p.game]}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <Price price={p.price} compareAt={p.compareAtPrice} />
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500">
              {p.isOfficialStore ? "Official store" : store?.storeName}
              {store?.status === "VERIFIED" && !p.isOfficialStore && <VerifiedBadge small />}
            </p>
          </div>
          <AddToCartButton productId={p.id} compact disabled={p.stock < 1} />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ items, savedIds = [] }: { items: ProductCardData[]; savedIds?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} saved={savedIds.includes(p.id)} priority={i < 4} />
      ))}
    </div>
  );
}
