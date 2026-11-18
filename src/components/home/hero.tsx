"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

type Banner = { id: string; title: string; subtitle: string | null; badge: string | null; ctaLabel: string; ctaHref: string; imageUrl: string };

/** Full-bleed hero: giant headline, CTAs, floating art inside spinning neon rings. Cycles admin banners. */
export function Hero({ banners, stats }: { banners: Banner[]; stats: { listings: number; sellers: number } }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[i];
  if (!b) return null;
  // Banners point at transparent character renders; older vector banners fall back to the render set.
  const FALLBACK = ["/media/skins/outfit-golden-seraph.webp", "/media/skins/outfit-abyssal-dragon.webp", "/media/skins/outfit-pharaoh-gold.webp"];
  const art = b.imageUrl.startsWith("/media/") || b.imageUrl.startsWith("https://") ? b.imageUrl : FALLBACK[i % FALLBACK.length];
  return (
    <section className="relative -mx-4 overflow-hidden px-4 pt-6 pb-4 lg:-mx-6 lg:px-6 lg:pt-12">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div key={b.id} className="relative z-10 page-enter">
          <span className="inline-flex items-center gap-2 rounded-full border border-mint/40 bg-mint/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-mint uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-mint" /> {b.badge ?? "#1 Skin Marketplace"}
          </span>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] font-black tracking-tight text-white uppercase drop-shadow-[0_0_30px_rgba(46,245,198,0.25)] sm:text-7xl xl:text-8xl">
            {b.title.split(" ").map((w, k) => (
              <span key={k} className={clsx("block", k % 2 === 1 && "text-outline")}>{w}</span>
            ))}
          </h1>
          <p className="mt-5 max-w-md text-sm text-zinc-300 sm:text-base">{b.subtitle ?? "#1 marketplace for PUBG Mobile & BGMI players — buy, sell and discover exclusive skins."}</p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href={b.ctaHref} className="btn-primary px-6 py-3 text-sm">
              <Zap className="size-4 fill-current" /> {b.ctaLabel}
            </Link>
            <Link href="/marketplace" className="group inline-flex items-center gap-2 text-sm font-semibold text-neon">
              Explore <span className="h-px w-8 bg-neon transition-all duration-300 group-hover:w-14" /> <ArrowRight className="size-4" />
            </Link>
          </div>
          <dl className="mt-9 flex gap-8">
            {[
              stats.listings > 0 ? [stats.listings, "Live drops"] : ["₹0", "Listing fee"],
              stats.sellers > 0 ? [stats.sellers, "Verified sellers"] : ["100%", "Player-ID only"],
              ["24/7", "Escrow protection"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <dt className="font-display text-2xl font-bold text-white">{n}</dt>
                <dd className="text-[11px] tracking-wider text-muted uppercase">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="pointer-events-none absolute -top-6 -right-24 aspect-square w-[95vw] max-w-[520px] opacity-45 sm:-right-10 sm:w-[70vw] lg:pointer-events-auto lg:relative lg:top-auto lg:right-auto lg:mx-auto lg:w-full lg:opacity-100">
          {/* spinning neon rings */}
          <div className="absolute inset-[6%] animate-spin-slow rounded-full border-2 border-dashed border-mint/40" />
          <div className="absolute inset-[14%] rounded-full bg-[conic-gradient(from_0deg,#2ef5c6,#ff2fb9,#7b2cff,#2ef5c6)] p-[3px] opacity-80 blur-[1px] [animation:spin_9s_linear_infinite_reverse]">
            <div className="size-full rounded-full bg-ink" />
          </div>
          <div className="absolute inset-[14%] rounded-full shadow-[0_0_80px_10px_rgba(255,47,185,0.35),inset_0_0_60px_rgba(46,245,198,0.25)]" />
          {/* pedestal glow */}
          <div className="absolute bottom-[9%] left-1/2 h-[9%] w-[58%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(46,245,198,0.55),rgba(255,47,185,0.25)_45%,transparent_70%)]" />
          <div className="absolute bottom-[11%] left-1/2 h-[4%] w-[44%] -translate-x-1/2 rounded-[50%] border border-mint/60 shadow-[0_0_24px_rgba(46,245,198,0.6)]" />
          {/* full-length character render, breaking out of the ring */}
          <div key={art} className="absolute inset-x-[10%] top-[-4%] bottom-[12%] animate-float page-enter">
            <Image src={art} alt={b.title} fill priority sizes="(max-width: 1024px) 80vw, 40vw" className="object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" unoptimized={art.endsWith(".svg")} />
          </div>
          {/* floating chips */}
          <div className="glass absolute top-[10%] -left-2 hidden lg:flex animate-float items-center gap-2 rounded-2xl border border-neon/40 px-3 py-2 text-xs shadow-neon sm:left-0">
            <Sparkles className="size-4 text-neon" /> Mythic drops
          </div>
          <div className="glass absolute right-0 bottom-[12%] hidden lg:flex animate-float items-center gap-2 rounded-2xl border border-mint/40 px-3 py-2 text-xs shadow-mint [animation-delay:-3s]">
            <ShieldCheck className="size-4 text-mint" /> Escrow safe
          </div>
        </div>
      </div>
      {banners.length > 1 && (
        <div className="mt-6 flex justify-center gap-2 lg:justify-start">
          {banners.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={`Show ${x.title}`} aria-current={k === i} className={clsx("h-1 rounded-full transition-all duration-500", k === i ? "w-10 bg-mint shadow-mint" : "w-4 bg-white/20 hover:bg-white/40")} />
          ))}
        </div>
      )}
    </section>
  );
}
