"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Gem } from "lucide-react";
import { formatINR } from "@/lib/money";

export type FlowItem = { id: string; slug: string; title: string; store: string; price: number; image: string };

/** 3D coverflow row, auto-advancing; drag/swipe, arrow keys and buttons supported. */
export function Coverflow({ items }: { items: FlowItem[] }) {
  const n = items.length;
  const [active, setActive] = useState(Math.floor(n / 2));
  const [paused, setPaused] = useState(false);
  const drag = useRef<number | null>(null);
  const go = useCallback((d: number) => setActive((a) => (a + d + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => go(1), 3500);
    return () => clearInterval(t);
  }, [paused, go, n]);

  if (!n) return null;
  return (
    <section aria-roledescription="carousel" aria-label="Featured drops" className="relative -mx-4 -mt-8 overflow-hidden py-2 lg:-mx-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        className="relative mx-auto h-[380px] max-w-6xl touch-pan-y select-none [perspective:1400px] sm:h-[420px]"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "ArrowLeft" ? go(-1) : e.key === "ArrowRight" ? go(1) : null)}
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerUp={(e) => {
          if (drag.current == null) return;
          const dx = e.clientX - drag.current;
          drag.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        {items.map((it, k) => {
          let d = k - active;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const ad = Math.abs(d);
          const hidden = ad > 3;
          return (
            <div
              key={it.id}
              aria-hidden={d !== 0}
              className="absolute top-1/2 left-1/2 w-[220px] transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] sm:w-[250px]"
              style={{
                transform: `translate(-50%, -50%) translateX(${d * 62}%) translateZ(${-ad * 120}px) rotateY(${d * -18}deg) scale(${1 - ad * 0.08})`,
                zIndex: 10 - ad,
                opacity: hidden ? 0 : 1 - ad * 0.18,
                filter: d === 0 ? "none" : `brightness(${1 - ad * 0.18}) saturate(${1 - ad * 0.1})`,
                pointerEvents: hidden ? "none" : "auto",
              }}
            >
              <div
                className={`glass overflow-hidden rounded-3xl border p-2.5 transition-shadow duration-700 ${d === 0 ? "border-neon shadow-neon" : "border-neon/30"}`}
                onClick={(e) => {
                  if (d !== 0) {
                    e.preventDefault();
                    setActive(k);
                  }
                }}
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_88%,rgba(46,245,198,0.18),transparent_60%),linear-gradient(165deg,#1b1530,#07080f)]">
                  <Image src={it.image} alt={it.title} fill sizes="260px" className="object-contain p-3 drop-shadow-[0_12px_22px_rgba(0,0,0,0.7)]" unoptimized={it.image.endsWith(".svg") || it.image.startsWith("/uploads/")} draggable={false} />
                  {d === 0 && <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-mint/50" />}
                </div>
                <div className={`flex items-end justify-between gap-2 px-1 pt-3 transition-opacity duration-500 ${d === 0 ? "opacity-100" : "opacity-0"}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{it.title}</p>
                    <p className="truncate text-[11px] text-muted">{it.store}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted uppercase">Price</p>
                    <p className="flex items-center gap-1 font-display text-sm font-bold"><Gem className="size-3 text-neon" />{formatINR(it.price)}</p>
                  </div>
                </div>
                <Link href={`/product/${it.slug}`} tabIndex={d === 0 ? 0 : -1} className={`btn-primary mt-3 w-full py-2 text-xs transition-opacity duration-500 ${d === 0 ? "opacity-100" : "opacity-40"}`}>
                  Buy Now
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto flex max-w-6xl justify-end gap-2 px-4">
        <button onClick={() => go(-1)} aria-label="Previous" className="btn-outline btn-sm"><ArrowLeft className="size-4" /></button>
        <button onClick={() => go(1)} aria-label="Next" className="btn-outline btn-sm"><ArrowRight className="size-4" /></button>
      </div>
    </section>
  );
}
