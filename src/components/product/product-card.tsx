import Link from "next/link";
import { BadgeCheck, Gem } from "lucide-react";
import type { ProductCardData } from "@/lib/services/catalog";
import { GAME_LABEL } from "@/lib/constants";
import { discountPercent, formatINR } from "@/lib/money";
import { RarityBadge } from "@/components/ui/badges";
import { MediaImage } from "./media-image";
import { WishlistButton } from "./wishlist-button";
import { AddToCartButton } from "./cart-buttons";

/** Glass "drop" card: magenta frame, inset art, price block, full-width mint action. */
export function ProductCard({ p, saved = false, priority }: { p: ProductCardData; saved?: boolean; priority?: boolean }) {
  const img = p.media[0]?.url ?? "/art/rifle-1.svg";
  const store = p.seller.seller;
  const off = discountPercent(p.price, p.compareAtPrice);
  return (
    <div className="group card-glow reveal flex flex-col p-2.5 sm:p-3">
      <Link href={`/product/${p.slug}`} className="relative block aspect-[4/3.6] overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_88%,rgba(46,245,198,0.18),transparent_60%),linear-gradient(165deg,#1b1530,#07080f)]" aria-label={p.title}>
        <MediaImage src={img} alt={p.media[0]?.alt ?? p.title} priority={priority} className="object-contain p-2 drop-shadow-[0_12px_22px_rgba(0,0,0,0.7)] transition duration-700 ease-out group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
        <div className="absolute top-2 left-2 flex gap-1">
          <RarityBadge rarity={p.rarity} />
          {off > 0 && <span className="badge border-mint/50 bg-mint/15 text-mint">-{off}%</span>}
        </div>
        <WishlistButton productId={p.id} initial={saved} className="absolute top-2 right-2" />
        {p.level && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 font-display text-[10px] font-bold tracking-widest text-mint backdrop-blur">
            LV.{p.level}{p.maxLevel ? `/${p.maxLevel}` : ""}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <Link href={`/product/${p.slug}`} className="line-clamp-2 text-sm leading-snug font-bold sm:line-clamp-1 text-white transition hover:text-mint">{p.title}</Link>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
              {p.isOfficialStore ? "Official store" : store?.storeName}
              {store?.status === "VERIFIED" && <BadgeCheck className="size-3 shrink-0 text-mint" aria-label="Verified" />}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="hidden text-[10px] tracking-wider text-muted uppercase sm:block">Price</p>
            <p className="flex items-center gap-1 sm:justify-end font-display text-sm font-bold text-white sm:text-base">
              <Gem className="size-3.5 text-neon" aria-hidden />
              {formatINR(p.price)}
            </p>
          </div>
        </div>
        <p className="line-clamp-1 text-[11px] text-zinc-500">{GAME_LABEL[p.game]}</p>
        <AddToCartButton productId={p.id} disabled={p.stock < 1} className="mt-auto w-full py-2.5 text-xs sm:text-sm" variant="primary" />
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
