"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";

type Banner = { id: string; title: string; subtitle: string | null; badge: string | null; ctaLabel: string; ctaHref: string; imageUrl: string };

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [paused, banners.length]);
  if (!banners.length) return null;
  return (
    <section aria-roledescription="carousel" aria-label="Promotions" className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="card relative h-56 overflow-hidden sm:h-72 lg:h-80">
        {banners.map((b, k) => (
          <div key={b.id} aria-hidden={k !== i} className={clsx("absolute inset-0 transition-opacity duration-700", k === i ? "opacity-100" : "pointer-events-none opacity-0")}>
            <Image src={b.imageUrl} alt="" fill priority={k === 0} sizes="100vw" className="object-cover object-right" unoptimized={b.imageUrl.endsWith(".svg")} />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            <div className="relative flex h-full max-w-lg flex-col justify-center gap-3 p-6 sm:p-10">
              {b.badge && <span className="badge w-fit border-neon/60 bg-neon/20 tracking-wider text-white uppercase">{b.badge}</span>}
              <h2 className="heading text-4xl leading-none italic sm:text-6xl">{b.title}</h2>
              {b.subtitle && <p className="text-sm text-zinc-300 sm:text-base">{b.subtitle}</p>}
              <Link href={b.ctaHref} tabIndex={k === i ? 0 : -1} className="btn-primary mt-1 w-fit">
                {b.ctaLabel} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, k) => (
            <button key={b.id} onClick={() => setI(k)} aria-label={`Show slide ${k + 1}`} aria-current={k === i} className={clsx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-neon" : "w-1.5 bg-zinc-600 hover:bg-zinc-400")} />
          ))}
        </div>
      )}
    </section>
  );
}
