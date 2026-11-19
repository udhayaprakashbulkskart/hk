import Link from "next/link";
import { BadgeCheck, Eye } from "lucide-react";
import type { ProductCardData } from "@/lib/services/catalog";
import { GAME_LABEL } from "@/lib/constants";
import { discountPercent, formatINR } from "@/lib/money";
import { RarityBadge } from "@/components/ui/badges";
import { MediaImage } from "./media-image";
import { WishlistButton } from "./wishlist-button";
import { AddToCartButton } from "./cart-buttons";

/** Product card: gold-framed art, rarity, original + sale price, wishlist, add to cart and view details. */
export function ProductCard({ p, saved = false, priority }: { p: ProductCardData; saved?: boolean; priority?: boolean }) {
  const img = p.media[0]?.url ?? "/art/rifle-1.svg";
  const store = p.seller.seller;
  const off = discountPercent(p.price, p.compareAtPrice);
  return (
    <div className="group card-glow reveal flex flex-col p-2.5 sm:p-3">
      <Link href={`/product/${p.slug}`} className="relative block aspect-[4/3.6] overflow-hidden rounded-lg border border-neon/20 bg-[radial-gradient(ellipse_at_50%_80%,rgba(242,193,78,0.22),transparent_60%),radial-gradient(circle_at_50%_30%,#8b1420,#2a070b_75%)]" aria-label={p.title}>
        <MediaImage src={img} alt={p.media[0]?.alt ?? p.title} priority={priority} className="object-contain p-2 drop-shadow-[0_12px_22px_rgba(0,0,0,0.7)] transition duration-700 ease-out group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
        <div className="absolute top-2 left-2 flex gap-1">
          <RarityBadge rarity={p.rarity} />
          {off > 0 && <span className="badge border-mint bg-mint text-white">-{off}%</span>}
        </div>
        <WishlistButton productId={p.id} initial={saved} className="absolute top-2 right-2" />
        {p.level && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold tracking-widest text-neon backdrop-blur">
            LV.{p.level}{p.maxLevel ? `/${p.maxLevel}` : ""}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <Link href={`/product/${p.slug}`} className="line-clamp-2 text-sm leading-snug font-bold sm:line-clamp-1 text-[#ffe9b8] transition hover:text-neon">{p.title}</Link>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
              {p.isOfficialStore ? "Official store" : store?.storeName}
              {store?.status === "VERIFIED" && <BadgeCheck className="size-3 shrink-0 text-neon" aria-label="Verified" />}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-sm font-extrabold text-neon sm:text-base">{formatINR(p.price)}</p>
            {off > 0 && p.compareAtPrice && <p className="text-[11px] text-[#b89a7a] line-through">{formatINR(p.compareAtPrice)}</p>}
          </div>
        </div>
        <p className="line-clamp-1 text-[11px] text-zinc-500">{GAME_LABEL[p.game]}</p>
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-1.5 sm:gap-2">
          <AddToCartButton productId={p.id} disabled={p.stock < 1} className="w-full gap-1 px-2 py-2.5 text-[11px] whitespace-nowrap sm:gap-2 sm:px-4 sm:text-sm" variant="primary" />
          <Link href={`/product/${p.slug}`} aria-label={`View details: ${p.title}`} title="View details" className="btn-outline px-2.5 py-2.5 sm:px-3">
            <Eye className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ items, savedIds = [] }: { items: ProductCardData[]; savedIds?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} saved={savedIds.includes(p.id)} priority={i < 4} />
      ))}
    </div>
  );
}
