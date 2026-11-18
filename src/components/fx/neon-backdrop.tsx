/**
 * Fixed, full-viewport animated backdrop: drifting neon ribbons (mint ↔ magenta ↔ violet),
 * soft colour fields and a faint grid. Pure SVG + CSS, no JS. Sits behind every page.
 */
export function NeonBackdrop() {
  const ribbons = [
    { d: "M-200 620 C 200 420, 520 780, 900 560 S 1500 380, 1900 600", c: "url(#rb-a)", w: 4, dur: "16s", o: 1 },
    { d: "M-200 680 C 260 520, 560 860, 940 640 S 1520 460, 1900 700", c: "url(#rb-b)", w: 3, dur: "20s", o: 0.85 },
    { d: "M-200 300 C 300 120, 700 460, 1100 240 S 1600 80, 1900 260", c: "url(#rb-b)", w: 2.5, dur: "22s", o: 0.55 },
    { d: "M-200 540 C 180 360, 600 700, 980 470 S 1540 300, 1900 520", c: "url(#rb-c)", w: 1.5, dur: "24s", o: 0.6 },
    { d: "M-200 760 C 300 640, 620 920, 1000 740 S 1560 580, 1900 780", c: "url(#rb-a)", w: 14, dur: "28s", o: 0.22 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* colour fields */}
      <div className="absolute -top-40 -left-40 size-[42rem] rounded-full bg-crimson/35 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 size-[36rem] rounded-full bg-neon/25 blur-[120px]" />
      <div className="absolute -bottom-40 left-1/4 size-[34rem] rounded-full bg-mint/15 blur-[120px]" />
      {/* grid */}
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255/.6)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.6)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {/* ribbons */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1700 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="rb-a" x1="0" x2="1">
            <stop offset="0" stopColor="#2ef5c6" stopOpacity="0" />
            <stop offset=".35" stopColor="#2ef5c6" />
            <stop offset=".7" stopColor="#ff2fb9" />
            <stop offset="1" stopColor="#7b2cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rb-b" x1="0" x2="1">
            <stop offset="0" stopColor="#ff2fb9" stopOpacity="0" />
            <stop offset=".4" stopColor="#ff2fb9" />
            <stop offset=".8" stopColor="#7b2cff" />
            <stop offset="1" stopColor="#2ef5c6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rb-c" x1="0" x2="1">
            <stop offset="0" stopColor="#7b2cff" stopOpacity="0" />
            <stop offset=".5" stopColor="#2ef5c6" />
            <stop offset="1" stopColor="#ff2fb9" stopOpacity="0" />
          </linearGradient>
          <filter id="rb-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g filter="url(#rb-glow)">
          {ribbons.map((r, i) => (
            <path key={i} d={r.d} fill="none" stroke={r.c} strokeWidth={r.w} strokeLinecap="round" opacity={r.o} className="neon-ribbon" style={{ animationDuration: r.dur, animationDelay: `${-i * 3}s` }} />
          ))}
        </g>
      </svg>
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(5_6_11/0.7)_100%)]" />
    </div>
  );
}
