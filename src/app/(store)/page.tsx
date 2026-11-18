import Link from "next/link";
import Image from "next/image";
import { Rotate3d } from "lucide-react";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { productCardSelect } from "@/lib/services/catalog";
import { RENDERS } from "@/lib/media";
import { ArcaneCircle, Crescent, GoldFrame, PriceTag, UnlockButton } from "@/components/home/ornate";

/* Showcase renders used for the poster scenes (owner-supplied). */
const SCENE = {
  center: RENDERS.goldenSeraph,
  left: [
    { src: RENDERS.ravenKnight, tag: "Raven Knight", sub: "Shadow of the Crow" },
    { src: RENDERS.crimsonGambler, tag: "Crimson Gambler", sub: "Fortune's Wager" },
  ],
  right: [
    { src: RENDERS.blossomEmpress, tag: "Blossom Empress", sub: "Petal Court" },
    { src: RENDERS.pharaohGold, tag: "Pharaoh Gold", sub: "Sands of Rule" },
  ],
};

const FALLBACK_STRIP = [RENDERS.moltenAkm, RENDERS.dragonfireSmg, RENDERS.celestialRifle, RENDERS.frostbiteRifle, RENDERS.scarecrowAkm, RENDERS.skullRider, RENDERS.signedMummy, RENDERS.tridentWarden];
const FALLBACK_FAN = [RENDERS.abyssalDragon, RENDERS.crimsonGambler, RENDERS.goldenSeraph, RENDERS.ravenKnight, RENDERS.pharaohGold];

/** Hanging vertical name banner (red ribbon with gold trim). */
function NameTag({ title, sub, className }: { title: string; sub: string; className?: string }) {
  return (
    <div className={`absolute z-20 hidden w-9 flex-col items-center sm:flex ${className}`}>
      <span className="h-6 w-px bg-gold/70" />
      <div className="relative flex flex-col items-center gap-2 border border-gold/70 bg-gradient-to-b from-[#9b1022] to-[#4c0711] px-1.5 py-3 [clip-path:polygon(0_0,100%_0,100%_92%,50%_100%,0_92%)]">
        <span className="font-serif text-[10px] leading-tight font-bold tracking-widest text-[#ffe9c4] [writing-mode:vertical-rl]">{title}</span>
        <span className="text-[9px] tracking-wider text-gold/80 [writing-mode:vertical-rl]">{sub}</span>
      </div>
    </div>
  );
}

const imgOk = (url?: string) => (url && (url.startsWith("/media/") || url.startsWith("/uploads/") || url.startsWith("https://")) ? url : undefined);

export default async function HomePage() {
  // Real listings drive prices; renders are only used for scenery and empty-state previews.
  const listings = await db.product.findMany({
    where: { status: "APPROVED", stock: { gt: 0 }, isOfficialStore: false },
    orderBy: { price: "desc" },
    take: 14,
    select: productCardSelect,
  });
  const withImg = listings.filter((p) => imgOk(p.media[0]?.url));
  const featured = withImg[0];
  const strip = withImg.slice(1, 9);
  // Tall cards suit full-length outfits; weapons only fill in if there are too few.
  const isFigure = (p: (typeof withImg)[number]) => ["outfits", "mythic-sets"].includes(p.category.slug);
  const fan = [...withImg.filter(isFigure), ...withImg.filter((p) => !isFigure(p))].slice(0, 5);
  const fanTotal = fan.reduce((s, p) => s + p.price, 0);
  const fanCompare = fan.reduce((s, p) => s + (p.compareAtPrice ?? p.price), 0);

  return (
    <div className="-mx-4 bg-[radial-gradient(ellipse_at_50%_0%,#3a1a1c,#160b0d_55%,#0b0708)] px-3 pb-16 sm:px-5 lg:-mx-6 lg:px-8">
      {/* ───────── 1. Hero poster ───────── */}
      <section className="pt-4">
        <GoldFrame>
          <div className="relative h-[560px] overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#c98a3a_0%,#7a3a1f_22%,#3b1414_48%,#140809_80%)] sm:h-[640px]">
            {/* light rays */}
            <div className="absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_50%_32%,rgb(255_220_150/0.10)_0deg_4deg,transparent_4deg_14deg)]" />
            <ArcaneCircle className="absolute top-[4%] left-1/2 w-[520px] max-w-[95%] -translate-x-1/2 opacity-60" />
            {/* side figures */}
            {SCENE.left.map((f, k) => (
              <div key={f.tag} className={`absolute bottom-[14%] hidden sm:block ${k === 0 ? "left-[1%] h-[78%] w-[24%]" : "left-[14%] h-[66%] w-[20%] opacity-90"}`}>
                <Image src={f.src} alt={f.tag} fill sizes="25vw" className="object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)]" />
              </div>
            ))}
            {SCENE.right.map((f, k) => (
              <div key={f.tag} className={`absolute bottom-[14%] hidden sm:block ${k === 0 ? "right-[1%] h-[78%] w-[24%]" : "right-[14%] h-[66%] w-[20%] opacity-90"}`}>
                <Image src={f.src} alt={f.tag} fill sizes="25vw" className="object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)]" />
              </div>
            ))}
            <NameTag title={SCENE.left[0].tag} sub={SCENE.left[0].sub} className="top-0 left-[24%]" />
            <NameTag title={SCENE.left[1].tag} sub={SCENE.left[1].sub} className="top-0 left-[33%]" />
            <NameTag title={SCENE.right[0].tag} sub={SCENE.right[0].sub} className="top-0 right-[24%]" />
            <NameTag title={SCENE.right[1].tag} sub={SCENE.right[1].sub} className="top-0 right-[33%]" />
            {/* centre hero */}
            <div className="absolute bottom-[12%] left-1/2 h-[88%] w-[60%] -translate-x-1/2 sm:w-[34%]">
              <Image src={SCENE.center} alt="Golden Seraph" fill priority sizes="(max-width: 640px) 60vw, 34vw" className="object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.85)]" />
            </div>
            {/* floor haze + title */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#140809] via-[#140809]/85 to-transparent" />
            <div className="absolute inset-x-0 bottom-[7%] text-center">
              <h1 className="bg-[linear-gradient(180deg,#fff4d6,#e8c57a_55%,#a8823f)] bg-clip-text font-serif text-5xl font-bold tracking-[0.12em] text-transparent uppercase drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] sm:text-7xl">
                Mythic Legends
              </h1>
              <p className="mt-3 flex items-center justify-center gap-4 font-serif text-sm tracking-[0.5em] text-[#f3dfb4] sm:text-base">
                <span className="h-px w-10 bg-gold/70" /> FATE · FORGED · IN GOLD <span className="h-px w-10 bg-gold/70" />
              </p>
            </div>
          </div>
        </GoldFrame>
      </section>

      {/* ───────── 2. Featured skin ───────── */}
      <section className="mt-12">
        <GoldFrame>
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#b9733a_0%,#5e2318_30%,#2a1215_60%,#140809_100%)]">
            {/* crimson silk */}
            <div className="absolute inset-y-[18%] -left-[10%] w-[55%] rounded-[50%] bg-[radial-gradient(ellipse_at_70%_50%,#c4142f,#7c0a1b_45%,transparent_70%)] opacity-80" />
            <div className="absolute inset-y-[18%] -right-[10%] w-[55%] rounded-[50%] bg-[radial-gradient(ellipse_at_30%_50%,#c4142f,#7c0a1b_45%,transparent_70%)] opacity-80" />
            <ArcaneCircle className="absolute top-[6%] left-1/2 w-[420px] max-w-[90%] -translate-x-1/2 opacity-50" />
            <div className="relative grid min-h-[520px] items-end gap-6 px-5 pt-8 pb-8 sm:px-10 md:grid-cols-[1fr_1.1fr_1fr]">
              <div className="order-2 md:order-1">
                <p className="font-serif text-sm tracking-[0.3em] text-gold">{featured ? featured.category.name : "Mythic Set"}</p>
                <h2 className="mt-1 flex items-center gap-3 font-serif text-3xl leading-tight font-bold text-[#fff1d2] sm:text-4xl">
                  {featured?.title ?? "Golden Seraph"}
                  <Link href={featured ? `/product/${featured.slug}` : "/skins"} aria-label="View in detail" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-gold/80 text-gold transition hover:bg-gold/15">
                    <Rotate3d className="size-5" />
                  </Link>
                </h2>
                <p className="mt-3 max-w-xs text-xs leading-relaxed text-gold/70">
                  {featured ? `Sold by ${featured.seller.seller?.storeName ?? "a verified seller"} · delivered to your Player ID` : "First mythic drops are landing soon from verified sellers."}
                </p>
              </div>
              <div className="relative order-1 mx-auto h-[420px] w-full max-w-sm md:order-2 md:h-[480px]">
                <Image src={imgOk(featured?.media[0]?.url) ?? RENDERS.pharaohGold} alt={featured?.title ?? "Pharaoh Gold"} fill sizes="(max-width: 768px) 80vw, 30vw" className="object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.85)]" />
              </div>
              <div className="order-3 flex flex-col items-start gap-4 md:items-end">
                {featured ? <PriceTag value={formatINR(featured.price)} note={featured.compareAtPrice ? `Was ${formatINR(featured.compareAtPrice)}` : undefined} /> : <PriceTag value="Soon" />}
                <UnlockButton href={featured ? `/product/${featured.slug}` : "/sell"}>{featured ? "UNLOCK NOW" : "SELL ONE"}</UnlockButton>
              </div>
            </div>
          </div>
        </GoldFrame>
      </section>

      {/* ───────── 3. Variant pack ───────── */}
      <section className="mt-12">
        <GoldFrame className="mx-auto max-w-5xl">
          <div className="bg-[linear-gradient(180deg,#3a1d1d,#241112)] px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-5 border-b border-gold/25 pb-5">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-2xl font-bold text-[#fff1d2] sm:text-3xl">Arsenal Collection</h2>
                <span className="rounded-sm bg-gold/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#2a1215] uppercase">{strip.length || 8} items</span>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                {strip.length ? <PriceTag value={formatINR(strip.reduce((s, p) => s + p.price, 0))} note="Buy individually — no bundle markup" /> : <PriceTag value="Soon" />}
                <UnlockButton href="/skins">VIEW ALL</UnlockButton>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-gold/70">Includes weapon skins and outfits from verified sellers. Every item is delivered through the game&apos;s official gifting or redeem system.</p>
            <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
              {(strip.length ? strip.map((p) => ({ key: p.id, src: p.media[0]!.url, name: p.title, price: formatINR(p.price), href: `/product/${p.slug}` })) : FALLBACK_STRIP.map((src, k) => ({ key: src, src, name: src.split("/").pop()!.replace(/^(gun|outfit)-|\.webp$/g, "").replace(/-/g, " "), price: "Soon", href: "/skins", k }))).map((it) => (
                <Link key={it.key} href={it.href} className="group flex flex-col items-center text-center">
                  <span className="relative grid aspect-square w-full place-items-center rounded-full border border-gold/50 bg-[radial-gradient(circle,#5a2a22,#1d0d0e_70%)] transition group-hover:border-gold group-hover:shadow-[0_0_24px_rgba(232,197,122,0.45)]">
                    <Image src={it.src} alt={it.name} fill sizes="12vw" className="object-contain p-2 transition duration-500 group-hover:scale-110" />
                  </span>
                  <span className="mt-2 line-clamp-2 text-[10px] text-[#f3dfb4] capitalize">{it.name}</span>
                  <span className="text-[11px] font-bold text-gold">{it.price}</span>
                </Link>
              ))}
            </div>
          </div>
        </GoldFrame>
      </section>

      {/* ───────── 4. Grand bundle ───────── */}
      <section className="mt-14">
        <GoldFrame className="mx-auto max-w-5xl">
          <div className="grid items-center gap-8 bg-[linear-gradient(160deg,#3a1d1d,#1c0d0e)] px-5 py-8 sm:px-8 md:grid-cols-[0.9fr_1.4fr]">
            <div className="text-center md:text-left">
              <h2 className="font-serif text-4xl font-bold text-[#fff1d2]">Legends Vault</h2>
              <p className="mt-1 flex items-center justify-center gap-2 font-serif text-sm tracking-[0.3em] text-gold md:justify-start">
                <Crescent className="size-4" /> GRAND BUNDLE <Crescent className="size-4 -scale-x-100" />
              </p>
              <p className="mt-4 text-xs text-gold/70">The five most-wanted drops on the market right now.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
                {["Mythic sets", "Legendary outfits", "Player-ID delivery"].map((t) => (
                  <span key={t} className="border border-gold/50 px-2 py-0.5 text-[11px] text-gold">{t}</span>
                ))}
              </div>
              <div className="mt-6 flex justify-center md:justify-start">
                {fan.length ? <PriceTag size="lg" value={formatINR(fanTotal)} note={fanCompare > fanTotal ? `Was ${formatINR(fanCompare)}` : undefined} /> : <PriceTag size="lg" value="Soon" />}
              </div>
              <UnlockButton href="/skins?sort=popular" className="mt-6">EXPLORE</UnlockButton>
            </div>
            {/* fan of tall framed cards */}
            <div className="flex items-end justify-center gap-2 sm:gap-3">
              {(fan.length ? fan.map((p) => ({ key: p.id, src: p.media[0]!.url, href: `/product/${p.slug}`, name: p.title })) : FALLBACK_FAN.map((src) => ({ key: src, src, href: "/skins", name: "Coming soon" }))).map((c, k) => (
                <Link
                  key={c.key}
                  href={c.href}
                  title={c.name}
                  className={`group relative w-[18%] border border-gold/70 p-1 transition duration-500 hover:-translate-y-2 ${k % 2 ? "aspect-[1/2.3] translate-y-6" : "aspect-[1/2.6]"}`}
                >
                  <span className="relative block size-full overflow-hidden border border-gold/30 bg-[radial-gradient(circle_at_50%_40%,#9a4a2a,#3a1515_55%,#140809)]">
                    <Image src={c.src} alt={c.name} fill sizes="12vw" className="object-contain object-bottom p-1 transition duration-700 group-hover:scale-110" />
                  </span>
                  <Crescent className="absolute -bottom-3 left-1/2 size-5 -translate-x-1/2 text-gold" />
                </Link>
              ))}
            </div>
          </div>
        </GoldFrame>
      </section>
    </div>
  );
}
