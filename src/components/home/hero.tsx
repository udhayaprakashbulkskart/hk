"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, MousePointer2, Play, Tag } from "lucide-react";

type Banner = { id: string; title: string; subtitle: string | null; badge: string | null; ctaLabel: string; ctaHref: string; imageUrl: string };

const FALLBACK = ["/media/skins/outfit-golden-seraph.webp", "/media/skins/outfit-abyssal-dragon.webp", "/media/skins/outfit-pharaoh-gold.webp"];

/** Editorial hero: bold three-line headline with typed accent line, real render framed by neon line art. */
export function Hero({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 6500);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[i];
  if (!b) return null;
  const art = b.imageUrl.startsWith("/media/") || b.imageUrl.startsWith("https://") ? b.imageUrl : FALLBACK[i % FALLBACK.length];

  return (
    <section className="relative -mx-4 border-b border-white/10 px-4 pt-8 pb-14 lg:-mx-6 lg:px-6 lg:pt-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div key={b.id} className="page-enter relative z-10">
          <p className="text-xs font-semibold tracking-[0.25em] text-mint uppercase">PUBG Mobile · BGMI Marketplace</p>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-white uppercase sm:text-6xl xl:text-7xl">
            <span className="block">Level up</span>
            <span className="block">your loadout</span>
            <span className="block text-neon">
              {b.title}
              <span className="caret ml-1 inline-block h-[0.12em] w-[0.5em] translate-y-[-0.05em] bg-neon align-baseline" />
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-300">
            {b.subtitle ?? "Officially transferable skins, outfits and UC from verified sellers — paid out only after you confirm delivery."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href={b.ctaHref} className="btn-primary px-6 py-3 text-xs tracking-[0.15em] uppercase">
              {b.ctaLabel} <ArrowRight className="size-4" />
            </Link>
            <Link href="/sell" className="group inline-flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-white uppercase">
              Sell your skins <Tag className="size-4 text-mint transition group-hover:rotate-12" />
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-6 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success shadow-[0_0_10px_#34d399]" />
              <span>
                <b className="block font-semibold tracking-wider text-zinc-200 uppercase">Verified sellers online</b>Escrow protected
              </span>
            </span>
            <span className="h-8 w-px bg-white/10" />
            <span className="flex items-center gap-2 tracking-wider uppercase">
              <MousePointer2 className="size-4" /> Scroll down
            </span>
          </div>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-[460px] lg:max-w-[520px]">
          {/* neon line-art frame */}
          <svg viewBox="0 0 400 500" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="hero-line" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="1" stopColor="#ff2d95" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="230" r="170" fill="none" stroke="url(#hero-line)" strokeWidth="1.2" opacity=".55" />
            <circle cx="200" cy="230" r="150" fill="none" stroke="#ff2d95" strokeWidth="0.6" strokeDasharray="2 10" opacity=".6" />
            <path d="M330 40 L390 40 L390 120" fill="none" stroke="#ff2d95" strokeWidth="1.5" opacity=".8" />
            <path d="M10 380 L10 470 L90 470" fill="none" stroke="#22d3ee" strokeWidth="1.5" opacity=".8" />
            <path d="M260 0 L400 160 M300 0 L400 110" stroke="#ff2d95" strokeWidth="0.8" opacity=".45" />
            <path d="M0 330 L120 500 M0 380 L80 500" stroke="#22d3ee" strokeWidth="0.8" opacity=".35" />
          </svg>
          {/* rim light behind the figure */}
          <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgb(255_45_149/0.35),rgb(124_58_237/0.18)_45%,transparent_70%)]" />
          <div key={art} className="page-enter absolute inset-x-[6%] top-[2%] bottom-[6%]">
            <Image src={art} alt={b.title} fill priority sizes="(max-width: 1024px) 90vw, 40vw" className="object-contain object-bottom drop-shadow-[0_24px_40px_rgba(0,0,0,0.75)]" unoptimized={art.endsWith(".svg")} />
          </div>
          {/* floor light */}
          <div className="absolute bottom-[3%] left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(255_45_149/0.55),transparent_70%)]" />
          {/* circular badge */}
          <Link href={b.ctaHref} className="group absolute right-0 bottom-[12%] grid size-24 place-items-center rounded-full border border-white/20 bg-ink/70 backdrop-blur sm:size-28">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full animate-[spin_14s_linear_infinite]" aria-hidden>
              <defs>
                <path id="badge-arc" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
              </defs>
              <text fontSize="8.5" letterSpacing="3" fill="#e5e7f5">
                <textPath href="#badge-arc">SHOP THE DROP · SHOP THE DROP ·</textPath>
              </text>
            </svg>
            <span className="grid size-10 place-items-center rounded-full bg-neon text-white shadow-[0_0_24px_rgb(255_45_149/0.7)] transition group-hover:scale-110">
              <Play className="size-4 fill-current" />
            </span>
          </Link>
        </div>
      </div>
      {banners.length > 1 && (
        <div className="mt-8 flex gap-2">
          {banners.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={`Show ${x.title}`} aria-current={k === i} className={clsx("h-1 rounded-full transition-all duration-500", k === i ? "w-10 bg-neon" : "w-4 bg-white/20 hover:bg-white/40")} />
          ))}
        </div>
      )}
    </section>
  );
}
