import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, ChevronRight, Coins, CreditCard, Headset, Heart, KeyRound, LogIn, Receipt, Settings, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { GAME_LABEL, RARITY_LABEL } from "@/lib/constants";
import { getHomeData, type ProductCardData } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { RENDERS } from "@/lib/media";
import { CATEGORY_NAV } from "@/components/layout/nav";
import { ProductGrid } from "@/components/product/product-card";
import { SectionHeader } from "@/components/ui/section";
import { RarityStars } from "@/components/ui/badges";
import { Countdown } from "@/components/home/countdown";

const CATEGORY_ART: Record<string, string> = {
  "weapon-skins": RENDERS.moltenAkm,
  outfits: RENDERS.ravenKnight,
  helmets: RENDERS.skullRider,
  backpacks: RENDERS.tridentWarden,
  vehicles: RENDERS.celestialRifle,
  crates: RENDERS.dragonfireSmg,
  bundles: RENDERS.pharaohGold,
};

const BENEFITS = [
  { Icon: ShieldCheck, title: "Secure payments", body: "Every payment is verified on our server before your order is confirmed." },
  { Icon: KeyRound, title: "No passwords, ever", body: "We never ask for game passwords or OTPs. Delivery needs your Player ID only." },
  { Icon: BadgeCheck, title: "Official store", body: "Every product is listed and delivered by ZYNOFLIX STORE — no third-party sellers." },
  { Icon: Headset, title: "Real support", body: "Raise a ticket from any order; refunds go back to your wallet or payment source." },
];

/** Small label/value pair used in the showcase detail bar. */
function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-neon">{k}:</p>
      <p className="truncate text-xs text-[#c9d1d8]">{v}</p>
    </div>
  );
}

/** Popular-skins tile: render on a soft panel, name and rarity stars. */
function SkinTile({ href, img, name, rarity }: { href: string; img: string; name: string; rarity?: ProductCardData["rarity"] }) {
  return (
    <Link href={href} className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.05] bg-[linear-gradient(170deg,#2f3439,#202327)] p-2 shadow-[8px_8px_20px_-8px_rgb(0_0_0/0.7),-4px_-4px_14px_-8px_rgb(255_255_255/0.05)] transition hover:-translate-y-1 hover:border-neon/50">
      <Image src={img} alt="" fill sizes="(min-width:1024px) 12vw, 40vw" className="object-contain object-top p-2 pb-10 transition duration-500 group-hover:scale-105" />
      <div className="relative rounded-xl bg-[#1b1e21]/85 px-2 py-1.5 text-center backdrop-blur">
        <p className="truncate text-[11px] font-medium text-white">{name}</p>
        {rarity ? <RarityStars rarity={rarity} className="size-2.5" /> : <p className="text-[10px] text-neon">Browse</p>}
      </div>
    </Link>
  );
}

const ACCOUNT_LINKS = [
  { href: "/orders", label: "My orders", Icon: Receipt },
  { href: "/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/account/settings", label: "Settings", Icon: Settings },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [data, saved, ucPacks, orderCount] = await Promise.all([
    getHomeData(),
    getSavedIds(user?.id),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: true, stock: { gt: 0 } }, orderBy: { price: "asc" }, take: 4, select: { id: true, ucAmount: true, price: true } }),
    user ? db.order.count({ where: { buyerId: user.id, status: { not: "CANCELLED" } } }) : Promise.resolve(0),
  ]);
  const c = data.campaign;
  const hero = data.featured[0] ?? data.trending[0] ?? null;
  const heroImg = hero?.media[0]?.url ?? c?.heroRight ?? RENDERS.ravenKnight;
  const popular = data.trending.filter((p) => p.id !== hero?.id).slice(0, 4);

  return (
    <div className="space-y-16 pb-8 sm:space-y-20">
      {/* ── Showcase dashboard ── */}
      <section className="card grid gap-4 p-3 sm:p-4 lg:grid-cols-[1.35fr_1fr_280px]">
        {/* Featured skin */}
        <div className="relative min-h-[420px] overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_30%_10%,#3b4148,#1d2024_70%)] sm:min-h-[480px]">
          <div className="absolute top-4 left-5 z-10">
            <h1 className="text-lg font-semibold text-white">{c?.title ?? "Skins List"}</h1>
            {c?.kicker && <p className="text-xs text-muted">{c.kicker}</p>}
          </div>
          {c?.endsAt && (
            <div className="absolute top-4 right-4 z-10 hidden sm:block">
              <Countdown endsAt={c.endsAt.toISOString()} compact />
            </div>
          )}
          <Image src={heroImg} alt={hero?.title ?? ""} fill priority sizes="(min-width:1024px) 45vw, 100vw" className="animate-float object-contain object-top px-6 pt-20 pb-40 drop-shadow-[0_30px_40px_rgb(0_0_0/0.6)]" />
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/[0.06] bg-[#1b1e21]/85 p-4 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md">
            {hero ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold text-white">{hero.title}</p>
                    <RarityStars rarity={hero.rarity} />
                  </div>
                  <Link href={`/product/${hero.slug}`} className="btn-primary px-6 text-xs">Choose skin</Link>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  <Spec k="Type" v={hero.category.name} />
                  <Spec k="Game" v={GAME_LABEL[hero.game]} />
                  <Spec k="Availability" v={hero.stock > 0 ? "In stock" : "Sold out"} />
                  <Spec k="Price" v={formatINR(hero.price)} />
                  <Spec k="Rarity" v={RARITY_LABEL[hero.rarity]} />
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{c?.subtitle ? "New drops landing soon" : "ZYNOFLIX STORE"}</p>
                  <p className="text-xs text-muted">{c?.subtitle ?? "PUBG Mobile & BGMI skins, outfits and UC top-ups."}</p>
                </div>
                <Link href="/uc" className="btn-primary px-6 text-xs">Top up UC</Link>
              </div>
            )}
          </div>
        </div>

        {/* Popular skins */}
        <div className="flex flex-col rounded-[22px] border border-white/[0.04] bg-[#1d2024]/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{popular.length ? "Most popular skins" : "Browse categories"}</h2>
            <Link href="/marketplace" className="text-xs text-neon hover:underline">View all</Link>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            {popular.length
              ? popular.map((p) => <SkinTile key={p.id} href={`/product/${p.slug}`} img={p.media[0]?.url ?? RENDERS.ravenKnight} name={p.title} rarity={p.rarity} />)
              : CATEGORY_NAV.filter((x) => ["outfits", "weapon-skins", "helmets", "bundles"].includes(x.slug)).map((x) => (
                  <SkinTile key={x.slug} href={`/category/${x.slug}`} img={CATEGORY_ART[x.slug]} name={x.label} />
                ))}
          </div>
        </div>

        {/* Profile panel */}
        <aside className="flex flex-col rounded-[22px] border border-white/[0.04] bg-[#1d2024]/70 p-4">
          <h2 className="text-sm font-semibold text-white">{user ? "My Profile" : "Welcome"}</h2>
          <div className="mt-4 flex flex-col items-center text-center">
            <span className="grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#3b4148] to-[#24282c] text-2xl font-semibold text-white ring-2 ring-neon/70 ring-offset-4 ring-offset-[#1d2024]">
              {user ? user.name.slice(0, 1).toUpperCase() : <LogIn className="size-6 text-neon" />}
            </span>
            <p className="mt-3 font-semibold text-white">{user ? user.name : "Guest player"}</p>
            <p className="text-xs text-muted">{user ? `${user.preferredGame === "PUBG_MOBILE" ? "PUBG Mobile" : "BGMI"} player` : "Sign in to track orders"}</p>
          </div>
          {user ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                <div><p className="text-neon">Orders:</p><p className="text-[#c9d1d8]">{orderCount}</p></div>
                <div><p className="text-neon">Wallet:</p><p className="text-[#c9d1d8]">{formatINR(user.walletBalance)}</p></div>
              </div>
              <nav className="mt-4 space-y-0.5">
                {ACCOUNT_LINKS.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-[#9aa4ad] transition hover:bg-white/[0.04] hover:text-white">
                    <Icon className="size-4" /> <span className="flex-1">{label}</span> <ChevronRight className="size-3.5" />
                  </Link>
                ))}
              </nav>
            </>
          ) : (
            <div className="mt-5 grid gap-2">
              <Link href="/login" className="btn-primary text-xs">Sign in</Link>
              <Link href="/register" className="btn-outline text-xs">Create account</Link>
            </div>
          )}
          <div className="mt-auto pt-5">
            <p className="text-center text-xs font-medium text-white">Payment methods</p>
            <div className="mt-2 flex justify-center gap-2">
              {[{ Icon: Smartphone, l: "UPI" }, { Icon: CreditCard, l: "Card" }, { Icon: Wallet, l: "Wallet" }].map(({ Icon, l }, i) => (
                <span key={l} title={l} className={`grid size-10 place-items-center rounded-xl border bg-[#24282c] shadow-[4px_4px_10px_-4px_rgb(0_0_0/0.7)] ${i === 2 ? "border-neon/70 text-neon" : "border-white/[0.06] text-[#9aa4ad]"}`}>
                  <Icon className="size-4" />
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ── Intro ── */}
      <section className="reveal grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-4xl leading-tight font-semibold text-white sm:text-5xl">Every skin.<br />Every outfit.<br /><span className="text-neon">One store.</span></h2>
          <p className="mt-4 max-w-md text-sm text-muted">If you&apos;re looking for PUBG Mobile and BGMI outfits, weapon skins, bundles and UC top-ups, you&apos;ve come to the right place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/marketplace" className="btn-primary px-7">Choose skin <ArrowRight className="size-4" /></Link>
            <Link href="/uc" className="btn-outline px-6"><Coins className="size-4" /> UC Top-Up</Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {CATEGORY_NAV.map((x) => (
            <Link key={x.slug} href={`/category/${x.slug}`} className="group card-glow flex flex-col items-center gap-1.5 p-2.5 text-center">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_35%,#3b4148,#1d2024_75%)]">
                <Image src={CATEGORY_ART[x.slug]} alt="" fill sizes="(min-width:1024px) 10vw, 22vw" className="object-contain p-1 transition duration-500 group-hover:scale-110" />
              </div>
              <span className="text-[11px] font-medium text-[#c9d1d8]">{x.label}</span>
            </Link>
          ))}
          <Link href="/uc" className="group card-glow flex flex-col items-center gap-1.5 p-2.5 text-center">
            <div className="grid aspect-square w-full place-items-center rounded-2xl bg-[radial-gradient(circle_at_50%_35%,#2a5d60,#1d2024_75%)]">
              <Coins className="size-8 text-neon transition group-hover:scale-110" />
            </div>
            <span className="text-[11px] font-medium text-[#c9d1d8]">UC Top-Up</span>
          </Link>
        </div>
      </section>

      {data.featured.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Legendary & Mythic" title="Featured skins" href="/marketplace?rarity=LEGENDARY&rarity=MYTHIC" />
          <ProductGrid items={data.featured} savedIds={saved} />
        </section>
      )}
      {data.deals.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Price drops" title="Limited-time offers" href="/marketplace?sort=price_asc" />
          <ProductGrid items={data.deals.slice(0, 4)} savedIds={saved} />
        </section>
      )}
      {data.bundles.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Value packs" title="Bundles" href="/category/bundles" />
          <ProductGrid items={data.bundles} savedIds={saved} />
        </section>
      )}

      {/* ── UC top-up ── */}
      {ucPacks.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Delivered to your Player ID" title="UC Top-Up" href="/uc" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ucPacks.map((p) => (
              <Link key={p.id} href="/uc" className="card-glow flex flex-col items-center gap-2 p-5 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#45d6d7] to-[#1a9ea2] text-[#062224] shadow-neon">
                  <Coins className="size-7" />
                </span>
                <span className="text-xl font-semibold text-white">{(p.ucAmount ?? 0).toLocaleString("en-IN")} UC</span>
                <span className="font-semibold text-neon">{formatINR(p.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.trending.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Most wanted" title="Best sellers" href="/marketplace?sort=popular" />
          <ProductGrid items={data.trending} savedIds={saved} />
        </section>
      )}
      {data.recent.length > 0 && (
        <section className="reveal">
          <SectionHeader kicker="Just in" title="Recently added" href="/marketplace?sort=newest" />
          <ProductGrid items={data.recent} savedIds={saved} />
        </section>
      )}

      {/* ── Benefits ── */}
      <section className="reveal">
        <SectionHeader kicker="Why ZYNOFLIX" title="Shop with confidence" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ Icon, title, body }) => (
            <div key={title} className="card p-5">
              <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#24282c] text-neon shadow-[4px_4px_10px_-4px_rgb(0_0_0/0.7)]">
                <Icon className="size-5" />
              </span>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
