import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Backpack, BadgeCheck, Car, Coins, Crosshair, Gift, HardHat, PackageCheck, ShieldCheck, Shirt, Sparkles, Store, Tag, Wallet,
} from "lucide-react";
import { getHomeData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Hero } from "@/components/home/hero";
import { DropTabs } from "@/components/home/drop-tabs";
import { ProductGrid } from "@/components/product/product-card";
import { RENDERS } from "@/lib/media";

const CAT_META: Record<string, { Icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  "weapon-skins": { Icon: Crosshair, blurb: "Upgradable guns with kill effects and finishes." },
  outfits: { Icon: Shirt, blurb: "Full outfits, tops and masks for every style." },
  "mythic-sets": { Icon: Sparkles, blurb: "The rarest sets — emotes, trails and voice packs." },
  vehicles: { Icon: Car, blurb: "Supercar and buggy skins that turn heads." },
  helmets: { Icon: HardHat, blurb: "Level-3 looks without the level-3 grind." },
  accessories: { Icon: Backpack, blurb: "Backpacks, parachutes and finishing touches." },
};

/** Centered section heading: small pink eyebrow + bold white title. */
function Heading({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="reveal relative mb-8 text-center">
      <p className="text-[11px] font-semibold tracking-[0.25em] text-neon uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-wide text-white uppercase sm:text-3xl">{title}</h2>
      {href && (
        <Link href={href} className="group absolute right-0 bottom-1 hidden items-center gap-1 text-xs font-semibold tracking-wider text-zinc-300 uppercase hover:text-white sm:flex">
          View all <ArrowRight className="size-3.5 text-neon transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

/** Corner-bracket frame (the reference's viewfinder corners). */
function Brackets() {
  const c = "absolute size-5 border-mint/80";
  return (
    <>
      <span className={`${c} top-0 left-0 border-t-2 border-l-2`} />
      <span className={`${c} top-0 right-0 border-t-2 border-r-2`} />
      <span className={`${c} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${c} right-0 bottom-0 border-r-2 border-b-2`} />
    </>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved, listingCount, ucPacks] = await Promise.all([
    getHomeData(),
    getSavedIds(user?.id),
    db.product.count({ where: { status: "APPROVED", isOfficialStore: false } }),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: true }, orderBy: { price: "asc" }, take: 6, select: { slug: true, ucAmount: true, price: true } }),
  ]);
  const looks = [
    { src: RENDERS.crimsonGambler, name: "Crimson Gambler", tag: "Outfit", href: "/skins?category=outfits" },
    { src: RENDERS.moltenAkm, name: "Molten AKM", tag: "Weapon skin", href: "/skins?category=weapon-skins" },
    { src: RENDERS.goldenSeraph, name: "Golden Seraph", tag: "Mythic set", href: "/skins?category=mythic-sets" },
    { src: RENDERS.dragonfireSmg, name: "Dragonfire SMG", tag: "Weapon skin", href: "/skins?category=weapon-skins" },
    { src: RENDERS.blossomEmpress, name: "Blossom Empress", tag: "Outfit", href: "/skins?category=outfits" },
  ];

  return (
    <div className="pb-6">
      <Hero banners={data.banners} />

      {/* Why us */}
      <section className="grid items-center gap-12 border-b border-white/10 py-16 lg:grid-cols-2">
        <div className="reveal relative mx-auto aspect-[4/3] w-full max-w-xl p-3">
          <Brackets />
          <div className="relative size-full overflow-hidden bg-[radial-gradient(circle_at_50%_55%,rgb(255_45_149/0.35),transparent_55%),radial-gradient(circle_at_50%_55%,rgb(34_211_238/0.25),transparent_70%),#0b0b14]">
            <div className="absolute top-1/2 left-1/2 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neon/70 shadow-[0_0_40px_rgb(255_45_149/0.6),inset_0_0_40px_rgb(34_211_238/0.4)]" />
            <Image src={RENDERS.abyssalDragon} alt="Abyssal dragon outfit render" fill sizes="(max-width: 1024px) 90vw, 40vw" className="object-contain py-4 drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
        <div className="reveal">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-neon uppercase">Why PUBG Store</p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-extrabold text-white uppercase sm:text-4xl">
            We turn rare skins
            <br />
            into <span className="bg-gradient-to-r from-neon to-mint bg-clip-text text-transparent">safe trades.</span>
          </h2>
          <p className="mt-5 max-w-lg text-zinc-300">
            Every seller is verified, every payment is held in escrow, and every delivery happens through the game&apos;s own gifting or redeem system — straight to your Player ID. No passwords. No OTPs. No risk.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[
              [Wallet, listingCount > 0 ? String(listingCount) : "₹0", listingCount > 0 ? "Live listings" : "Listing fee"],
              [ShieldCheck, "100%", "Escrow protected"],
              [Gift, "24/7", "Player-ID delivery"],
            ].map(([Icon, n, l]) => {
              const I = Icon as typeof Wallet;
              return (
                <div key={l as string} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <I className="size-7 text-neon" />
                  <div>
                    <dt className="font-display text-2xl font-extrabold text-mint">{n as string}</dt>
                    <dd className="text-[11px] tracking-wider text-zinc-400 uppercase">{l as string}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
          <Link href="/support" className="btn-outline mt-8 text-xs tracking-[0.15em] uppercase">
            How it works <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Categories (services grid) */}
      <section className="border-b border-white/10 py-16">
        <Heading eyebrow="What you can buy" title="Categories" href="/skins" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.categories.map((c) => {
            const m = CAT_META[c.slug] ?? { Icon: Sparkles, blurb: "" };
            return (
              <Link key={c.id} href={`/skins?category=${c.slug}`} className="card-glow reveal group flex flex-col items-center gap-3 px-3 py-6 text-center">
                <m.Icon className="size-8 text-neon transition duration-500 group-hover:scale-110 group-hover:text-mint" />
                <p className="font-display text-xs font-bold tracking-wider text-white uppercase">{c.name}</p>
                <p className="text-xs leading-relaxed text-zinc-400">{m.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Shop the look (selected work) */}
      <section className="border-b border-white/10 py-16">
        <Heading eyebrow="Featured renders" title="Shop the look" href="/skins" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {looks.map((l, k) => (
            <Link key={l.name} href={l.href} className={`reveal group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_60%,rgb(255_45_149/0.28),transparent_60%),linear-gradient(170deg,#161626,#07070c)] ${k === 4 ? "hidden lg:block" : ""}`}>
              <Image src={l.src} alt={l.name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-contain p-4 drop-shadow-[0_16px_24px_rgba(0,0,0,0.8)] transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                <p className="text-sm font-bold text-white">{l.name}</p>
                <p className="text-[11px] text-zinc-400">{l.tag}</p>
              </div>
              <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/40 opacity-0 backdrop-blur transition group-hover:opacity-100">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live drops, only when real listings exist */}
      {data.trending.length > 0 && (
        <section className="border-b border-white/10 py-16">
          <Heading eyebrow="Live on the market" title="Hot drops" href="/marketplace" />
          <DropTabs
            tabs={[
              { key: "new", label: "New Drops", href: "/marketplace", content: <ProductGrid items={data.recent} savedIds={saved} /> },
              { key: "popular", label: "Most Popular", href: "/marketplace?sort=popular", content: <ProductGrid items={data.trending} savedIds={saved} /> },
              { key: "deals", label: "Deals", href: "/marketplace?sort=price_asc", content: <ProductGrid items={data.deals.length ? data.deals : data.recent} savedIds={saved} /> },
            ]}
          />
        </section>
      )}

      {/* UC packs (tools row) */}
      {ucPacks.length > 0 && (
        <section className="border-b border-white/10 py-16">
          <Heading eyebrow="Instant · Player ID only" title="UC Top-Up" href="/uc" />
          <div className="flex flex-wrap justify-center gap-4">
            {ucPacks.map((u) => (
              <Link key={u.slug} href={`/product/${u.slug}`} className="reveal group flex w-28 flex-col items-center gap-2 text-center">
                <span className="grid size-16 place-items-center rounded-xl border border-white/10 bg-panel-2 transition group-hover:border-neon/70 group-hover:shadow-neon">
                  <Coins className="size-7 text-amber-300" />
                </span>
                <span className="font-display text-sm font-extrabold text-white">{u.ucAmount?.toLocaleString("en-IN")} UC</span>
                <span className="text-xs text-zinc-400">{formatINR(u.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Numbers + how it works */}
      <section className="grid gap-10 border-b border-white/10 py-16 lg:grid-cols-2 lg:gap-0">
        <div className="reveal lg:border-r lg:border-white/10 lg:pr-10">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-neon uppercase">Stats</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white uppercase">By the numbers</h2>
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              [Store, listingCount > 0 ? String(listingCount) : "New", "Listings"],
              [BadgeCheck, data.sellers.length > 0 ? String(data.sellers.length) : "Open", "Verified sellers"],
              [Tag, "₹0", "Listing fee"],
              [PackageCheck, "24/7", "Escrow"],
            ].map(([Icon, n, l]) => {
              const I = Icon as typeof Store;
              return (
                <div key={l as string} className="flex flex-col items-center gap-2 text-center">
                  <I className="size-7 text-neon" />
                  <dt className="font-display text-2xl font-extrabold text-mint">{n as string}</dt>
                  <dd className="text-[11px] tracking-wider text-zinc-400 uppercase">{l as string}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div className="reveal lg:pl-10">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-neon uppercase">How it works</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white uppercase">Three steps. Zero risk.</h2>
          <ol className="mt-8 space-y-4">
            {[
              ["Pick your skin", "Browse verified listings or top up UC — enter only your Player ID."],
              ["Seller delivers", "Sent through the game's official gifting or redeem code. Your money waits in escrow."],
              ["Confirm & done", "Confirm receipt and the seller is paid. Not delivered? Request a refund."],
            ].map(([t, d], k) => (
              <li key={t} className="card flex gap-4 p-4">
                <span className="font-display text-2xl font-extrabold text-neon">0{k + 1}</span>
                <div>
                  <p className="font-bold text-white">{t}</p>
                  <p className="mt-1 text-sm text-zinc-400">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Sell CTA */}
      <section className="reveal grid items-center gap-8 py-16 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.25em] text-neon uppercase">Get started</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-white uppercase sm:text-4xl">Have skins to sell? Let&apos;s get you listed.</h2>
          <p className="mt-3 max-w-xl text-zinc-300">Verification takes under a day. No listing fees — a small commission only when you sell.</p>
        </div>
        <Link href="/sell" className="btn h-14 bg-gradient-to-r from-neon to-mint px-10 text-sm tracking-[0.15em] text-white uppercase shadow-[0_10px_40px_-10px_rgb(255_45_149/0.8)] hover:brightness-110">
          Start selling <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

