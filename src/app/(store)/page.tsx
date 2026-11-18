import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Backpack, BadgeCheck, Car, Coins, Crosshair, HardHat, LifeBuoy, ShieldCheck, Shirt, Sparkles, Tag } from "lucide-react";
import { getHomeData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Hero } from "@/components/home/hero";
import { Coverflow } from "@/components/home/coverflow";
import { DropTabs } from "@/components/home/drop-tabs";
import { ProductGrid } from "@/components/product/product-card";
import { Stars } from "@/components/ui/badges";
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

function SectionTitle({ outline, solid, href }: { outline: string; solid: string; href?: string }) {
  return (
    <div className="reveal mb-6 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl leading-none font-black tracking-wider uppercase sm:text-4xl">
        <span className="text-outline">{outline}</span> <span className="text-white">{solid}</span>
      </h2>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-mint">
          View all <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved, listingCount] = await Promise.all([getHomeData(), getSavedIds(user?.id), db.product.count({ where: { status: "APPROVED", isOfficialStore: false } })]);
  const flow = [...data.featured, ...data.trending.filter((t) => !data.featured.some((f) => f.id === t.id))].slice(0, 9).map((p) => ({
    id: p.id, slug: p.slug, title: p.title, store: p.isOfficialStore ? "Official store" : (p.seller.seller?.storeName ?? ""), price: p.price, image: p.media[0]?.url ?? "/art/rifle-1.svg",
  }));
  const collage = ["/art/figure-1.svg", "/art/figure-4.svg", "/art/helmet-1.svg", "/art/figure-2.svg", "/art/car-1.svg"];

  return (
    <div className="space-y-20 pb-6">
      <Hero banners={data.banners} stats={{ listings: listingCount, sellers: data.sellers.length }} />

      {flow.length > 0 && <Coverflow items={flow} />}

      <nav aria-label="Quick actions" className="reveal grid grid-cols-4 gap-2 sm:gap-4">
        {QUICK.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="card-glow group flex flex-col items-center gap-2 px-1 py-5 text-center text-xs font-semibold text-zinc-300 hover:text-white sm:text-sm">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-mint/25 to-neon/25 transition duration-500 group-hover:scale-110 group-hover:rotate-6">
              <Icon className="size-5 text-mint" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {/* "FANTASY NFT MARKET"-style collage */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="reveal relative grid h-[340px] grid-cols-6 grid-rows-6 gap-2 sm:h-[420px]">
          {[
            "col-span-2 row-span-4 col-start-1 row-start-2",
            "col-span-2 row-span-3 col-start-3 row-start-1",
            "col-span-2 row-span-2 col-start-3 row-start-4",
            "col-span-2 row-span-4 col-start-5 row-start-1",
            "col-span-2 row-span-2 col-start-5 row-start-5",
          ].map((cls, k) => (
            <div key={k} className={`${cls} group relative overflow-hidden rounded-2xl border border-white/10`}>
              <Image src={collage[k]} alt="" fill sizes="(max-width: 1024px) 33vw, 16vw" className="scale-125 object-cover transition duration-1000 group-hover:scale-150" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            </div>
          ))}
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-neon/20 via-transparent to-mint/20 blur-2xl" />
        </div>
        <div className="reveal">
          <h2 className="font-display leading-none font-black tracking-wider uppercase">
            <span className="text-outline block text-5xl sm:text-7xl">MYTHIC</span>
            <span className="mt-2 block text-3xl text-white sm:text-5xl">SKIN MARKET</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-300">
            India&apos;s premium marketplace for officially transferable PUBG Mobile &amp; BGMI cosmetics. Buy, sell and discover exclusive skins from verified sellers — paid out only after you confirm delivery.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {data.categories.map((c) => {
              const Icon = CAT_ICON[c.slug] ?? Sparkles;
              return (
                <Link key={c.id} href={`/skins?category=${c.slug}`} className="chip group">
                  <Icon className="size-3.5 text-mint transition group-hover:rotate-12" /> {c.name}
                </Link>
              );
            })}
          </div>
          <Link href="/skins" className="btn-primary mt-8 px-7 py-3">Learn More</Link>
        </div>
      </section>

      <div>
        <SectionTitle outline="HOT" solid="DROPS" href="/marketplace" />
        {data.trending.length ? (
          <DropTabs
            tabs={[
              { key: "new", label: "New Drops", href: "/marketplace?sort=price_desc", content: <ProductGrid items={data.recent} savedIds={saved} /> },
              { key: "popular", label: "Most Popular", href: "/marketplace?sort=popular", content: <ProductGrid items={data.trending} savedIds={saved} /> },
              { key: "deals", label: "Deals", href: "/marketplace?sort=price_asc", content: <ProductGrid items={data.deals.length ? data.deals : data.recent} savedIds={saved} /> },
              { key: "featured", label: "Featured", href: "/marketplace", content: <ProductGrid items={data.featured.length ? data.featured : data.trending} savedIds={saved} /> },
            ]}
          />
        ) : (
          <EmptyState title="No listings yet" body="Be the first to list an item." action={{ href: "/sell", label: "Start selling" }} />
        )}
      </div>

      <Link href="/uc" className="card-glow reveal group relative flex items-center gap-5 overflow-hidden p-6 sm:p-10">
        <div className="absolute inset-0 -z-10 animate-gradient bg-[linear-gradient(110deg,rgba(123,44,255,.35),rgba(255,47,185,.15),rgba(46,245,198,.25))] bg-[length:200%_200%]" />
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-mint uppercase">Instant · Secure · Player ID only</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-wider uppercase sm:text-5xl">
            <span className="text-outline">UC</span> Top-Up
          </h2>
          {data.ucFrom != null && <p className="mt-2 text-sm text-zinc-300">Packs from {formatINR(data.ucFrom)}</p>}
        </div>
        <div className="relative size-24 shrink-0 animate-float sm:size-36">
          <Image src="/art/coin-1.svg" alt="" fill className="rounded-3xl object-cover" unoptimized />
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint text-black shadow-mint transition group-hover:translate-x-1">
          <ArrowRight className="size-5" />
        </span>
      </Link>

      {data.sellers.length > 0 && (
        <section>
          <SectionTitle outline="TOP" solid="SELLERS" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.sellers.map((s, k) => (
              <Link key={s.user.id} href={`/seller/${s.user.id}`} className="card-glow reveal flex items-center gap-3 p-4">
                <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint via-neon to-crimson font-display text-xl font-black text-black">
                  {s.storeName.slice(0, 1)}
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-white/20 bg-ink font-display text-[10px] text-mint">#{k + 1}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {s.storeName} <BadgeCheck className="size-4 shrink-0 text-mint" />
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <Stars value={s.ratingAvg} count={s.ratingCount} /> {s.user._count.products} listings
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [ShieldCheck, "Escrow protection", "Sellers are paid only after you confirm delivery."],
          [BadgeCheck, "Verified sellers", "Every seller is identity-checked by our team."],
          [LifeBuoy, "Never your password", "We only need your Player ID — never your login or OTP."],
        ].map(([Icon, t, b]) => {
          const I = Icon as typeof ShieldCheck;
          return (
            <div key={t as string} className="card-glow reveal flex gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint/15"><I className="size-5 text-mint" /></span>
              <div>
                <p className="font-display text-sm font-bold tracking-wider uppercase">{t as string}</p>
                <p className="mt-1 text-sm text-muted">{b as string}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
