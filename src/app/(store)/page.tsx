import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Coins, Crosshair, Gift, PackageCheck, ShieldCheck, Shirt, Sparkles, Tag, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { getHomeData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { RENDERS } from "@/lib/media";
import { DropTabs } from "@/components/home/drop-tabs";
import { ProductGrid } from "@/components/product/product-card";

/** Section header: amber kicker + condensed title + optional link, with a hazard tick. */
function Head({ kicker, title, href, cta = "View all" }: { kicker: string; title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-neon uppercase">
          <span className="hazard inline-block h-2.5 w-6 rounded-[2px]" /> {kicker}
        </p>
        <h2 className="mt-1 font-display text-4xl leading-none font-semibold tracking-wide text-white uppercase sm:text-5xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-bold text-neon">
          {cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

const TILES = [
  { href: "/skins?category=outfits", label: "Skins & Outfits", sub: "Mythic sets, outfits, helmets", img: RENDERS.ravenKnight, Icon: Shirt },
  { href: "/guns", label: "Gun Skins", sub: "Upgradable weapons & finishes", img: RENDERS.moltenAkm, Icon: Crosshair },
  { href: "/uc", label: "UC Top-Up", sub: "Instant to your Player ID", img: null, Icon: Coins },
  { href: "/sell", label: "Sell Items", sub: "List in minutes, get paid", img: null, Icon: Tag },
];

const CATS = [
  { slug: "mythic-sets", name: "Mythic Sets", img: RENDERS.goldenSeraph },
  { slug: "weapon-skins", name: "Gun Skins", img: RENDERS.dragonfireSmg },
  { slug: "outfits", name: "Outfits", img: RENDERS.crimsonGambler },
  { slug: "helmets", name: "Helmets", img: RENDERS.skullRider },
  { slug: "mythic-sets", name: "Legendary", img: RENDERS.pharaohGold },
  { slug: "weapon-skins", name: "Rifles", img: RENDERS.celestialRifle },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved, ucPacks, liveCount] = await Promise.all([
    getHomeData(),
    getSavedIds(user?.id),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: true, stock: { gt: 0 } }, orderBy: { price: "asc" }, take: 6, select: { id: true, slug: true, ucAmount: true, price: true } }),
    db.product.count({ where: { status: "APPROVED", isOfficialStore: false, stock: { gt: 0 } } }),
  ]);
  const bestValue = ucPacks.length ? ucPacks.reduce((best, p) => ((p.ucAmount ?? 0) / p.price > (best.ucAmount ?? 0) / best.price ? p : best)) : null;

  return (
    <div className="space-y-20 pb-8">
      {/* ── Hero ── */}
      <section className="relative -mx-4 overflow-hidden border-b border-white/[0.07] px-4 pt-6 pb-12 lg:-mx-6 lg:px-6 lg:pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="page-enter">
            <span className="inline-flex items-center gap-2 rounded border border-neon/40 bg-neon/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.2em] text-neon uppercase">
              <Zap className="size-3.5 fill-current" /> PUBG Mobile · BGMI
            </span>
            <h1 className="mt-5 font-display text-[3.6rem] leading-[0.88] font-semibold tracking-wide text-white uppercase sm:text-8xl xl:text-[7.5rem]">
              Gear up.
              <br />
              <span className="text-neon">Drop in.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-300">
              Buy skins, gun finishes and outfits from verified sellers, or top up UC in seconds. Everything is delivered to your Player ID — you never share a password or OTP.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/skins" className="btn-primary px-7 py-3.5 text-base">
                Buy Skins <ArrowRight className="size-4" />
              </Link>
              <Link href="/uc" className="btn-outline px-7 py-3.5 text-base">
                <Coins className="size-4 text-neon" /> UC Top-Up
              </Link>
            </div>
            <ul className="mt-9 grid max-w-lg grid-cols-3 gap-3 text-xs text-zinc-400">
              {[
                [ShieldCheck, "Escrow protected"],
                [BadgeCheck, "Verified sellers"],
                [Gift, "Player-ID delivery"],
              ].map(([I, t]) => {
                const Icon = I as typeof ShieldCheck;
                return (
                  <li key={t as string} className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-neon" /> {t as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px]">
            <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgb(245_179_1/0.32),rgb(255_122_26/0.12)_45%,transparent_70%)]" />
            <div className="absolute inset-x-[8%] top-[8%] bottom-[4%] border border-white/10 [clip-path:polygon(0_6%,6%_0,100%_0,100%_94%,94%_100%,0_100%)]" />
            <Image src={RENDERS.goldenSeraph} alt="Golden armour outfit" fill priority sizes="(max-width: 1024px) 80vw, 36vw" className="object-contain object-bottom drop-shadow-[0_24px_36px_rgba(0,0,0,0.75)]" />
            <div className="absolute bottom-[10%] -left-2 rounded-lg border border-white/10 bg-panel/95 px-4 py-3 shadow-card sm:left-0">
              <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Live listings</p>
              <p className="font-display text-3xl leading-none font-semibold text-white">{liveCount > 0 ? liveCount : "Opening soon"}</p>
            </div>
            {bestValue && (
              <Link href={`/checkout?product=${bestValue.id}`} className="absolute top-[14%] right-0 rounded-lg bg-neon px-4 py-2.5 text-[#111] shadow-neon transition hover:-translate-y-0.5">
                <p className="text-[10px] font-bold tracking-widest uppercase">Best value UC</p>
                <p className="font-display text-2xl leading-none font-semibold">
                  {bestValue.ucAmount?.toLocaleString("en-IN")} UC · {formatINR(bestValue.price)}
                </p>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick tiles ── */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="card-glow reveal group relative flex h-40 flex-col justify-end overflow-hidden p-4 sm:h-48">
            {t.img ? (
              <Image src={t.img} alt="" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-contain object-right p-3 opacity-70 transition duration-500 group-hover:scale-110 group-hover:opacity-100" />
            ) : (
              <t.Icon className="absolute top-4 right-4 size-16 text-neon/25 transition duration-500 group-hover:scale-110 group-hover:text-neon/50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111317] via-[#111317]/70 to-transparent" />
            <div className="relative">
              <t.Icon className="mb-2 size-6 text-neon" />
              <p className="font-display text-2xl leading-none font-semibold text-white uppercase sm:text-3xl">{t.label}</p>
              <p className="mt-1 text-xs text-zinc-400">{t.sub}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* ── UC Top-up ── */}
      {ucPacks.length > 0 && (
        <section>
          <Head kicker="Instant · Player ID only" title="UC Top-Up" href="/uc" cta="All packs" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {ucPacks.map((p) => (
              <div key={p.id} className={`card reveal relative flex flex-col items-center gap-2 p-4 text-center ${p.id === bestValue?.id ? "border-neon/70" : ""}`}>
                {p.id === bestValue?.id && <span className="absolute -top-2.5 rounded bg-neon px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#111] uppercase">Best value</span>}
                <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-neon to-mint text-[#111] shadow-neon">
                  <Coins className="size-7" />
                </span>
                <p className="font-display text-3xl leading-none font-semibold text-white">{p.ucAmount?.toLocaleString("en-IN")} UC</p>
                <p className="text-sm font-bold text-neon">{formatINR(p.price)}</p>
                <Link href={`/checkout?product=${p.id}`} className="btn-primary btn-sm mt-1 w-full py-2">
                  Top up now
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Live listings ── */}
      <section>
        <Head kicker="Live on the market" title="Hot Drops" href="/marketplace" />
        {data.trending.length ? (
          <DropTabs
            tabs={[
              { key: "popular", label: "Trending", href: "/marketplace?sort=popular", content: <ProductGrid items={data.trending} savedIds={saved} /> },
              { key: "new", label: "New", href: "/marketplace", content: <ProductGrid items={data.recent} savedIds={saved} /> },
              { key: "deals", label: "Deals", href: "/marketplace?sort=price_asc", content: <ProductGrid items={data.deals.length ? data.deals : data.recent} savedIds={saved} /> },
            ]}
          />
        ) : (
          <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center sm:flex-row sm:text-left">
            <Sparkles className="size-10 shrink-0 text-neon" />
            <div className="flex-1">
              <p className="font-display text-3xl leading-none font-semibold text-white uppercase">First drops landing soon</p>
              <p className="mt-2 text-sm text-zinc-400">Verified sellers are setting up. Own transferable skins? List them first and get the spotlight.</p>
            </div>
            <Link href="/sell" className="btn-primary px-6">Start selling</Link>
          </div>
        )}
      </section>

      {/* ── Categories ── */}
      <section>
        <Head kicker="Find your style" title="Shop by Category" href="/skins" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATS.map((c) => (
            <Link key={c.name} href={`/skins?category=${c.slug}`} className="card-glow reveal group flex flex-col">
              <div className="relative aspect-[3/4] bg-[radial-gradient(ellipse_at_50%_80%,rgb(245_179_1/0.18),transparent_60%)]">
                <Image src={c.img} alt={c.name} fill sizes="(max-width: 640px) 50vw, 16vw" className="object-contain p-3 drop-shadow-[0_14px_22px_rgba(0,0,0,0.7)] transition duration-500 group-hover:scale-110" />
              </div>
              <p className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2.5 font-display text-xl leading-none font-semibold text-white uppercase">
                {c.name} <ArrowRight className="size-4 text-neon transition group-hover:translate-x-1" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section>
        <Head kicker="Safe by design" title="How it works" />
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            [Sparkles, "Choose", "Pick a skin, gun finish or UC pack. Enter only your in-game Player ID at checkout."],
            [PackageCheck, "Receive", "The seller sends it with the game's official gifting or redeem code. Your payment waits in escrow."],
            [ShieldCheck, "Confirm", "Confirm you received it and the seller gets paid. Not delivered? Request a refund."],
          ].map(([I, t, d], k) => {
            const Icon = I as typeof Sparkles;
            return (
              <li key={t as string} className="card reveal relative overflow-hidden p-6">
                <span className="absolute -top-3 -right-1 font-display text-[7rem] leading-none font-semibold text-white/[0.04]">0{k + 1}</span>
                <Icon className="size-8 text-neon" />
                <p className="mt-4 font-display text-3xl leading-none font-semibold text-white uppercase">
                  {k + 1}. {t as string}
                </p>
                <p className="mt-2 text-sm text-zinc-400">{d as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Sell banner ── */}
      <section className="reveal relative overflow-hidden rounded-xl border border-neon/40 bg-[linear-gradient(110deg,#1e1a10,#13161b_55%)] p-6 sm:p-10">
        <div className="hazard absolute inset-x-0 top-0 h-1.5" />
        <div className="relative z-10 max-w-xl">
          <p className="text-[11px] font-bold tracking-[0.22em] text-neon uppercase">For sellers</p>
          <h2 className="mt-1 font-display text-4xl leading-none font-semibold text-white uppercase sm:text-6xl">Turn your skins into cash</h2>
          <p className="mt-3 text-sm text-zinc-300">Get verified in under a day. No listing fees — a small commission only when you sell. Payouts straight to UPI.</p>
          <Link href="/sell" className="btn-primary mt-6 px-7 py-3">
            Start selling <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="absolute -right-6 bottom-0 hidden h-[115%] w-[34%] sm:block">
          <Image src={RENDERS.crimsonGambler} alt="" fill sizes="30vw" className="object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)]" />
        </div>
      </section>
    </div>
  );
}
