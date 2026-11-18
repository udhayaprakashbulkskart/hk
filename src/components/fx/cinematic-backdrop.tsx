/**
 * Clean cinematic backdrop: near-black base, soft corner light, fine film grain and two bundles
 * of fibre-optic light streaks (pink → cyan) parked at the edges — nothing sits behind body text.
 * One composited transform animation per bundle; no blur filters (cheap on phones).
 */
function Streaks({ count, flip, className }: { count: number; flip?: boolean; className: string }) {
  const paths = Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const y0 = 520 - t * 140;
    const c1 = 380 - t * 220;
    const c2 = 160 + t * 260;
    return `M -40 ${y0} C 220 ${c1}, 420 ${c2}, 760 ${40 + t * 120}`;
  });
  return (
    <svg viewBox="0 0 720 560" className={className} preserveAspectRatio="none" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <defs>
        <linearGradient id={`st-${flip ? "r" : "l"}`} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="#ff2d95" stopOpacity="0" />
          <stop offset=".25" stopColor="#ff2d95" />
          <stop offset=".65" stopColor="#a855f7" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="streaks" fill="none" stroke={`url(#st-${flip ? "r" : "l"})`} strokeLinecap="round">
        {paths.map((d, i) => (
          <path key={i} d={d} strokeWidth={i % 7 === 0 ? 1.6 : 0.6} opacity={0.25 + ((i * 37) % 60) / 100} />
        ))}
      </g>
    </svg>
  );
}

export function CinematicBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      {/* soft corner light */}
      <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_100%_0%,rgb(255_45_149/0.12),transparent_60%),radial-gradient(50rem_40rem_at_0%_0%,rgb(124_58_237/0.12),transparent_60%),radial-gradient(40rem_30rem_at_50%_110%,rgb(34_211_238/0.08),transparent_60%)]" />
      {/* light streaks at the edges */}
      <Streaks count={46} className="absolute -bottom-16 -left-24 h-[46vh] w-[62vw] max-w-[760px] opacity-60 sm:opacity-80" />
      <Streaks count={38} flip className="absolute top-[34vh] -right-28 h-[40vh] w-[46vw] max-w-[620px] opacity-40 sm:opacity-70" />
      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E&quot;)]" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55)_100%)]" />
    </div>
  );
}
