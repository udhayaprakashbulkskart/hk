import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Backpack, BadgeCheck, Car, Coins, Crosshair, Flame, HardHat, LifeBuoy, ShieldCheck, Shirt, Sparkles, Tag, Zap } from "lucide-react";
import { getHomeData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { BannerCarousel } from "@/components/home/banner-carousel";
import { ProductGrid } from "@/components/product/product-card";
import { SectionHeader } from "@/components/ui/section";
import { Stars, VerifiedBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "weapon-skins": Crosshair, outfits: Shirt, "mythic-sets": Sparkles, vehicles: Car, helmets: HardHat, accessories: Backpack,
};

const QUICK = [
  { href: "/skins", label: "Buy Skins", Icon: Crosshair },
  { href: "/sell", label: "Sell Items", Icon: Tag },
  { href: "/uc", label: "UC Top-Up", Icon: Coins },
  { href: "/support", label: "Support", Icon: LifeBuoy },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved] = await Promise.all([getHomeData(), getSavedIds(user?.id)]);

  return (
    <div className="space-y-10">
      <BannerCarousel banners={data.banners} />

      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 sm:gap-3">
        {QUICK.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="card-glow flex flex-col items-center gap-2 px-1 py-4 text-center text-xs font-medium text-zinc-300 hover:text-white sm:text-sm">
            <Icon className="size-6 text-neon" />
            {label}
          </Link>
        ))}
      </nav>

      <section>
        <SectionHeader title="Categories" href="/skins" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {data.categories.map((c) => {
            const Icon = CAT_ICON[c.slug] ?? Sparkles;
            return (
              <Link key={c.id} href={`/skins?category=${c.slug}`} className="card-glow group flex flex-col items-center gap-2 px-2 py-4 text-center">
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-neon/25 to-crimson/20 text-neon transition group-hover:scale-110">
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold sm:text-sm">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Trending Skins" href="/skins?sort=popular" icon={<Flame className="size-5 fill-neon text-neon" />} />
        {data.trending.length ? <ProductGrid items={data.trending} savedIds={saved} /> : <EmptyState title="No listings yet" body="Be the first to list an item." action={{ href: "/sell", label: "Start selling" }} />}
      </section>

      <Link href="/uc" className="card-glow relative flex items-center gap-4 overflow-hidden p-5 sm:p-7">
        <div className="absolute inset-0 bg-gradient-to-r from-crimson/50 via-transparent to-amber-500/10" />
        <div className="relative flex-1">
          <h2 className="heading text-2xl sm:text-3xl">UC Top-Up</h2>
          <p className="mt-1 text-sm text-zinc-300">Instant · Secure · Player ID only{data.ucFrom ? ` · from ${formatINR(data.ucFrom)}` : ""}</p>
        </div>
        <div className="relative size-20 shrink-0 sm:size-24">
          <Image src="/art/coin-1.svg" alt="" fill className="rounded-2xl object-cover" unoptimized />
        </div>
        <span className="relative grid size-10 place-items-center rounded-full bg-neon shadow-neon">
          <ArrowRight className="size-5" />
        </span>
      </Link>

      {data.featured.length > 0 && (
        <section>
          <SectionHeader title="Featured" href="/marketplace" icon={<Sparkles className="size-5 text-neon" />} />
          <ProductGrid items={data.featured.slice(0, 4)} savedIds={saved} />
        </section>
      )}

      {data.deals.length > 0 && (
        <section>
          <SectionHeader title="Featured Deals" href="/marketplace?sort=price_asc" icon={<Zap className="size-5 fill-amber-400 text-amber-400" />} />
          <ProductGrid items={data.deals.slice(0, 4)} savedIds={saved} />
        </section>
      )}

      <section>
        <SectionHeader title="Recently Listed" href="/marketplace?sort=newest" />
        <ProductGrid items={data.recent} savedIds={saved} />
      </section>

      {data.sellers.length > 0 && (
        <section>
          <SectionHeader title="Popular Sellers" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.sellers.map((s) => (
              <Link key={s.user.id} href={`/seller/${s.user.id}`} className="card-glow flex items-center gap-3 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon to-crimson font-display text-xl font-bold">{s.storeName.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {s.storeName} <VerifiedBadge small />
                  </p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                    <Stars value={s.ratingAvg} count={s.ratingCount} /> · {s.totalSales} sold · {s.user._count.products} listings
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [ShieldCheck, "Escrow protection", "Sellers are paid only after you confirm delivery."],
          [BadgeCheck, "Verified sellers", "Every seller is identity-checked by our team."],
          [LifeBuoy, "Never your password", "We only ever need your Player ID — never your login or OTP."],
        ].map(([Icon, t, b]) => {
          const I = Icon as typeof ShieldCheck;
          return (
            <div key={t as string} className="card flex gap-3 p-4">
              <I className="size-6 shrink-0 text-neon" />
              <div>
                <p className="font-semibold">{t as string}</p>
                <p className="text-sm text-muted">{b as string}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
