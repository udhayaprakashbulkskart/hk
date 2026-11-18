import Link from "next/link";
import clsx from "clsx";

/** Gold filigree corner (original drawing). Rotated for each corner. */
function Corner({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 80 80" className={clsx("pointer-events-none absolute size-14 text-gold sm:size-20", className)} aria-hidden>
      <path d="M2 78 V22 Q2 2 22 2 H78" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 78 V26 Q8 8 26 8 H78" fill="none" stroke="currentColor" strokeWidth="0.8" opacity=".6" />
      <path d="M14 30 Q14 14 30 14" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="22" cy="22" r="3.2" fill="currentColor" />
      <path d="M22 12 L24 20 L32 22 L24 24 L22 32 L20 24 L12 22 L20 20 Z" fill="currentColor" opacity=".85" />
    </svg>
  );
}

/** Ornate double-rule gold frame with filigree corners and a crescent crest. */
export function GoldFrame({ children, className, crest = true }: { children: React.ReactNode; className?: string; crest?: boolean }) {
  return (
    <div className={clsx("relative border border-gold/60 p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.6),0_30px_80px_-30px_rgb(0_0_0/0.9)]", className)}>
      <div className="relative h-full border border-gold/30">
        {children}
      </div>
      <Corner className="-top-1 -left-1" />
      <Corner className="-top-1 -right-1 rotate-90" />
      <Corner className="-right-1 -bottom-1 rotate-180" />
      <Corner className="-bottom-1 -left-1 -rotate-90" />
      {crest && <Crescent className="absolute -bottom-4 left-1/2 size-8 -translate-x-1/2 text-gold" />}
    </div>
  );
}

export function Crescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M26 6 A15 15 0 1 0 26 34 A12 12 0 1 1 26 6 Z" fill="currentColor" />
      <path d="M31 14 L32 18 L36 19 L32 20 L31 24 L30 20 L26 19 L30 18 Z" fill="currentColor" />
    </svg>
  );
}

/** Rotating arcane circle: rings, ticks and runic dots (original geometric drawing). */
export function ArcaneCircle({ className }: { className?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="0 0 400 400" className={clsx("animate-[spin_80s_linear_infinite]", className)} aria-hidden>
      <g fill="none" stroke="#e8c57a">
        <circle cx="200" cy="200" r="196" strokeWidth="1" opacity=".7" />
        <circle cx="200" cy="200" r="180" strokeWidth=".6" opacity=".5" />
        <circle cx="200" cy="200" r="130" strokeWidth="1.2" opacity=".6" />
        <circle cx="200" cy="200" r="70" strokeWidth=".8" opacity=".5" />
        {ticks.map((a) => (
          <line key={a} x1="200" y1="6" x2="200" y2={a % 30 === 0 ? 26 : 16} transform={`rotate(${a} 200 200)`} strokeWidth={a % 30 === 0 ? 1.4 : 0.6} opacity=".8" />
        ))}
        <polygon points="200,22 354,289 46,289" strokeWidth=".8" opacity=".45" />
        <polygon points="200,378 46,111 354,111" strokeWidth=".8" opacity=".45" />
      </g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx="200" cy="54" r="4" fill="#e8c57a" opacity=".85" transform={`rotate(${a} 200 200)`} />
      ))}
    </svg>
  );
}

/** Red ornate pill button with gold trim and arrow-point ends. */
export function UnlockButton({ href, children, className, disabled }: { href: string; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={clsx(
        "group relative inline-flex h-12 min-w-44 items-center justify-center px-10 font-serif text-base font-bold tracking-[0.2em] text-[#fff3dd] transition",
        "[clip-path:polygon(14px_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,14px_100%,0_50%)]",
        "bg-[linear-gradient(180deg,#d9233f,#8f0d22)] shadow-[inset_0_1px_0_rgba(255,220,180,0.5)] hover:brightness-115",
        disabled && "pointer-events-none opacity-60 grayscale",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-[3px] [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,12px_100%,0_50%)] border border-gold/70" />
      <span className="absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/25 transition-all duration-700 group-hover:left-[120%]" />
      {children}
    </Link>
  );
}

/** "PRICE" lozenge + big serif number (₹). */
export function PriceTag({ value, note, size = "md" }: { value: string; note?: string; size?: "md" | "lg" }) {
  return (
    <div className="flex items-end gap-2">
      <span className="mb-2 rounded-sm border border-gold/60 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-gold uppercase">Price</span>
      <div>
        <p className={clsx("font-serif leading-none font-bold text-[#f7e3b5] drop-shadow-[0_2px_10px_rgba(232,197,122,0.35)]", size === "lg" ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl")}>{value}</p>
        {note && <p className="mt-1 text-[11px] text-gold/70">{note}</p>}
      </div>
    </div>
  );
}
