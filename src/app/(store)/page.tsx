import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Coins, Headset, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { getHomeData, type ProductCardData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { RENDERS } from "@/lib/media";
import { CATEGORY_NAV } from "@/components/layout/nav";
import { NavIcon } from "@/components/layout/icons";
import { ProductGrid } from "@/components/product/product-card";
import { SectionHeader, Flourish } from "@/components/ui/section";
import { Frame } from "@/components/ui/frame";
import { Countdown } from "@/components/home/countdown";
import { CloudScroll, Lantern } from "@/components/fx/festive-backdrop";

const CATEGORY_ART: Record<string, string | undefined> = {
  "weapon-skins": RENDERS.moltenAkm,
  outfits: RENDERS.ravenKnight,
  helmets: RENDERS.skullRider,
  backpacks: RENDERS.tridentWarden,
  vehicles: RENDERS.celestialRifle,
  crates: RENDERS.dragonfireSmg,
  bundles: RENDERS.blossomEmpress,
};

const BENEFITS = [
  { Icon: ShieldCheck, title: "Escrow protection", body: "Seller payouts are released only after you confirm delivery or the protection window passes." },
  { Icon: KeyRound, title: "No passwords, ever", body: "We never ask for game passwords or OTPs. UC goes to your Player ID only." },
  { Icon: BadgeCheck, title: "Verified sellers", body: "Sellers complete verification before listing, and every listing is reviewed." },
  { Icon: Headset, title: "Real support", body: "Raise a ticket or dispute from any order; refunds go back to your wallet or payment source." },
];

function ProductSection({ kicker, title, href, items, saved }: { kicker: string; title: string; href: string; items: ProductCardData[]; saved: string[] }) {
  if (!items.length) return null;
  return (
    <section className="reveal">
      <SectionHeader kicker={kicker} title={title} href={href} />
      <ProductGrid items={items} savedIds={saved} />
    </section>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved, ucPacks] = await Promise.all([
    getHomeData(),
    getSavedIds(user?.id),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: true, stock: { gt: 0 } }, orderBy: { price: "asc" }, take: 4, select: { id: true, ucAmount: true, price: true } }),
  ]);
  const c = data.campaign;
  const hasListings = data.recent.length > 0;

  return (
    <div className="space-y-16 pb-8 sm:space-y-20">
      {/* ── Festival hero ── */}
      <section className="relative -mx-4 overflow-hidden px-4 pt-6 pb-10 lg:-mx-6 lg:px-6">
        <Lantern className="absolute top-0 left-2 w-8 sm:left-8 sm:w-12" />
        <Lantern className="absolute top-0 right-2 w-8 sm:right-8 sm:w-12" delay="1.4s" />
        <div className="relative mx-auto grid max-w-6xl items-end gap-4 md:grid-cols-[1fr_1.3fr_1fr]">
          <div className="relative hidden h-[440px] md:block">
            <Image src={c?.heroLeft || RENDERS.blossomEmpress} alt="" fill priority sizes="30vw" className="animate-float object-contain object-bottom drop-shadow-[0_20px_40px_rgb(0_0_0/0.7)]" />
          </div>
          <div className="relative z-10 text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-neon/60 bg-[#5c0a12]/70 px-4 py-1 text-[11px] font-semibold tracking-[0.25em] text-neon-soft uppercase">
              {c?.kicker || "Festival marketplace"}
            </p>
            {c?.nativeTitle && <p className="gold-text font-serif text-5xl leading-none font-black sm:text-7xl" lang="zh">{c.nativeTitle}</p>}
            <h1 className="heading mt-2 text-4xl leading-tight sm:text-6xl">
              <span className="gold-text">{c?.title || "DROPZONE STORE"}</span>
            </h1>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Flourish flip /> <span className="text-xs tracking-[0.3em] text-[#e7cfa8] uppercase">PUBG Mobile · BGMI</span> <Flourish />
            </div>
            <p className="mx-auto mt-4 max-w-md text-sm text-[#f3dcb8] sm:text-base">
              {c?.subtitle || "Weapon skins, outfits, bundles and UC top-ups from verified sellers — paid securely, delivered through in-game methods the games allow."}
            </p>
            {c?.endsAt && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <span className="text-[11px] tracking-[0.25em] text-mint uppercase">Ends in</span>
                <Countdown endsAt={c.endsAt.toISOString()} />
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={c?.ctaHref || "/marketplace"} className="btn-primary px-7 py-3 text-base">
                {c?.ctaLabel || "Shop now"} <ArrowRight className="size-4" />
              </Link>
              <Link href="/uc" className="btn-outline px-6 py-3 text-base">
                <Coins className="size-4" /> UC Top-Up
              </Link>
            </div>
          </div>
          <div className="relative hidden h-[440px] md:block">
            <Image src={c?.heroRight || RENDERS.goldenSeraph} alt="" fill priority sizes="30vw" className="animate-float object-contain object-bottom drop-shadow-[0_20px_40px_rgb(0_0_0/0.7)] [animation-delay:1.5s]" />
          </div>
          {/* phone: a single render under the copy */}
          <div className="relative mx-auto h-64 w-full max-w-xs md:hidden">
            <Image src={c?.heroRight || RENDERS.goldenSeraph} alt="" fill sizes="80vw" className="object-contain object-bottom" />
          </div>
        </div>
        <CloudScroll className="absolute bottom-0 left-0 w-56 opacity-60 sm:w-80" />
        <CloudScroll className="absolute right-0 bottom-0 w-56 opacity-60 sm:w-80" flip />
      </section>

      {/* ── Categories ── */}
      <section className="reveal">
        <SectionHeader kicker="Browse" title="Shop by category" href="/marketplace" />
        <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
          {CATEGORY_NAV.map((cat) => (
            <Link key={cat.slug} href={`/category/${cat.slug}`} className="group card-glow flex flex-col items-center gap-1 p-2 text-center sm:p-3">
              <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_40%,#7a1420,#2a070b_75%)]">
                {CATEGORY_ART[cat.slug] ? (
                  <Image src={CATEGORY_ART[cat.slug]!} alt="" fill sizes="(min-width:1024px) 12vw, 25vw" className="object-contain p-1 transition duration-500 group-hover:scale-110" />
                ) : (
                  <NavIcon name={cat.icon} className="size-8 text-neon" />
                )}
              </div>
              <span className="text-[11px] font-semibold text-[#ffe9b8] sm:text-xs">{cat.label}</span>
            </Link>
          ))}
          <Link href="/uc" className="group card-glow flex flex-col items-center gap-1 p-2 text-center sm:p-3">
            <div className="grid aspect-square w-full place-items-center rounded-lg bg-[radial-gradient(circle_at_50%_40%,#b8862b,#5c0a12_75%)]">
              <Coins className="size-9 text-[#ffe08a] transition group-hover:scale-110" />
            </div>
            <span className="text-[11px] font-semibold text-[#ffe9b8] sm:text-xs">UC Top-Up</span>
          </Link>
        </div>
      </section>

      {/* ── Promo banners (admin → Banners) ── */}
      {data.banners.length > 0 && (
        <section className="reveal -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {data.banners.slice(0, 3).map((b) => (
            <Link key={b.id} href={b.ctaHref} className="group card-glow relative flex h-40 w-[80%] shrink-0 snap-start items-center overflow-hidden p-4 sm:w-auto">
              <div className="relative z-10 max-w-[60%]">
                {b.badge && <span className="mb-1 inline-block rounded bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">{b.badge}</span>}
                <p className="heading gold-text text-xl leading-tight">{b.title}</p>
                {b.subtitle && <p className="mt-1 line-clamp-2 text-xs text-[#f3dcb8]">{b.subtitle}</p>}
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-neon">{b.ctaLabel} <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
              </div>
              <Image src={b.imageUrl} alt="" width={180} height={180} className="absolute -right-4 bottom-0 h-full w-auto object-contain transition duration-500 group-hover:scale-105" unoptimized={b.imageUrl.endsWith(".svg") || b.imageUrl.startsWith("/uploads/")} />
            </Link>
          ))}
        </section>
      )}

      <ProductSection kicker="Legendary & Mythic" title="Featured legendary items" href="/marketplace?rarity=LEGENDARY&rarity=MYTHIC" items={data.featured} saved={saved} />

      {/* ── Limited-time offers ── */}
      {data.deals.length > 0 && (
        <section className="reveal">
          <Frame>
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.25em] text-mint uppercase">Price drops</p>
                  <h2 className="heading gold-text text-2xl sm:text-3xl">Limited-time offers</h2>
                </div>
                {c?.endsAt && <Countdown endsAt={c.endsAt.toISOString()} compact />}
              </div>
              <ProductGrid items={data.deals.slice(0, 4)} savedIds={saved} />
            </div>
          </Frame>
        </section>
      )}

      <ProductSection kicker="Festival" title="Festival bundles" href="/category/bundles" items={data.bundles} saved={saved} />

      {/* ── Exclusive outfit showcase ── */}
      {data.outfits.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Showcase" title="Exclusive outfits" href="/category/outfits" />
          <div className="grid gap-4 md:grid-cols-3">
            {data.outfits.map((p, i) => (
              <Link key={p.id} href={`/product/${p.slug}`} className="group">
                <Frame>
                  <div className="relative h-80 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_30%,#9e1420,#2a070b_70%)]">
                    {p.media[0] && <Image src={p.media[0].url} alt={p.media[0].alt ?? p.title} fill sizes="(min-width:768px) 33vw, 100vw" className="object-contain object-bottom transition duration-700 group-hover:scale-105" />}
                    <span className="absolute top-3 left-3 rounded-full border border-neon/60 bg-[#2a070b]/80 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-neon uppercase">{p.rarity}</span>
                    {i === 0 && <span className="absolute top-3 right-3 rounded bg-mint px-2 py-0.5 text-[10px] font-bold text-white">TOP PICK</span>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1c0507] via-[#1c0507]/80 to-transparent p-4 pt-12">
                      <p className="heading text-lg text-[#ffe9b8]">{p.title}</p>
                      <p className="mt-1 flex items-baseline gap-2">
                        <span className="font-bold text-neon">{formatINR(p.price)}</span>
                        {p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="text-xs text-[#b89a7a] line-through">{formatINR(p.compareAtPrice)}</span>}
                      </p>
                    </div>
                  </div>
                </Frame>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── UC top-up teaser ── */}
      {ucPacks.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Delivered to your Player ID" title="UC Top-Up" href="/uc" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ucPacks.map((p) => (
              <Link key={p.id} href="/uc" className="card-glow flex flex-col items-center gap-2 p-4 text-center">
                <span className="grid size-14 place-items-center rounded-full border border-[#fff1c2]/60 bg-gradient-to-b from-[#ffe08a] to-[#b8862b] text-[#3a0a0e] shadow-neon">
                  <Coins className="size-7" />
                </span>
                <span className="heading text-xl text-[#ffe9b8]">{(p.ucAmount ?? 0).toLocaleString("en-IN")} UC</span>
                <span className="font-bold text-neon">{formatINR(p.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductSection kicker="Most wanted" title="Best sellers" href="/marketplace?sort=popular" items={data.trending} saved={saved} />
      <ProductSection kicker="Just in" title="Recently added" href="/marketplace?sort=newest" items={data.recent} saved={saved} />

      {!hasListings && (
        <section className="reveal">
          <Frame>
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <h2 className="heading gold-text text-2xl sm:text-3xl">First festival drops landing soon</h2>
              <p className="max-w-lg text-sm text-[#f3dcb8]">Verified sellers are preparing their listings. Own officially transferable cosmetics? List them and reach buyers first.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/sell" className="btn-primary">Start selling</Link>
                <Link href="/uc" className="btn-outline">Top up UC</Link>
              </div>
            </div>
          </Frame>
        </section>
      )}

      {/* ── Benefits ── */}
      <section className="reveal">
        <SectionHeader kicker="Why DROPZONE" title="Shop with confidence" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ Icon, title, body }) => (
            <div key={title} className="card p-5">
              <span className="mb-3 grid size-11 place-items-center rounded-full border border-neon/60 bg-[#5c0a12] text-neon">
                <Icon className="size-5" />
              </span>
              <h3 className="heading text-base text-[#ffe9b8]">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-[#b89a7a]">
          <Zap className="size-3.5 shrink-0 text-neon" /> Payments by Razorpay, verified on our server before any order is marked paid.
        </p>
      </section>
    </div>
  );
}
