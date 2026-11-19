/**
 * Festival backdrop: lacquer-red gradient, gold cloud scrollwork, hanging lanterns,
 * a few falling blossom petals and soft firework bursts. All original SVG/CSS.
 * Fixed, non-interactive, transform/opacity-only animation (cheap on high-DPI phones).
 */
const PETALS = [
  { l: "8%", d: "14s", delay: "0s", s: 12 },
  { l: "22%", d: "18s", delay: "4s", s: 9 },
  { l: "41%", d: "16s", delay: "8s", s: 11 },
  { l: "63%", d: "20s", delay: "2s", s: 10 },
  { l: "79%", d: "15s", delay: "6s", s: 13 },
  { l: "93%", d: "19s", delay: "10s", s: 8 },
];
const BURSTS = [
  { t: "12%", l: "14%", s: 140, delay: "0s" },
  { t: "8%", l: "78%", s: 180, delay: "1.6s" },
  { t: "34%", l: "88%", s: 110, delay: "3s" },
];

export function CloudScroll({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 240 90" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden fill="none">
      <g stroke="#f2c14e" strokeWidth="2.2" strokeLinecap="round" opacity=".85">
        <path d="M10 70c0-16 14-26 28-22 4-16 24-22 36-10 10-14 34-12 40 6 16-6 30 6 28 20" />
        <path d="M44 62c0-8 10-12 15-5M86 58c2-9 14-10 18-2" />
        <path d="M120 72c0-12 12-20 24-16 6-12 24-14 32-2 12-6 26 4 24 18" />
        <path d="M150 66c2-6 10-8 14-2" />
        <path d="M6 80h228" opacity=".5" />
      </g>
    </svg>
  );
}

export function Lantern({ className = "", delay = "0s" }: { className?: string; delay?: string }) {
  return (
    <svg viewBox="0 0 60 140" className={`lantern ${className}`} style={{ animationDelay: delay }} aria-hidden>
      <defs>
        <radialGradient id="lt-g" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#ff5a4a" />
          <stop offset=".6" stopColor="#c4111f" />
          <stop offset="1" stopColor="#6d0a12" />
        </radialGradient>
      </defs>
      <line x1="30" y1="0" x2="30" y2="30" stroke="#f2c14e" strokeWidth="1.5" />
      <rect x="20" y="28" width="20" height="6" rx="2" fill="#f2c14e" />
      <ellipse cx="30" cy="66" rx="26" ry="32" fill="url(#lt-g)" stroke="#f2c14e" strokeWidth="1.5" />
      <path d="M30 34v64M17 38c-6 16-6 40 0 56M43 38c6 16 6 40 0 56" stroke="#f2c14e" strokeWidth="1" opacity=".6" fill="none" />
      <rect x="20" y="96" width="20" height="6" rx="2" fill="#f2c14e" />
      <path d="M24 102v28M30 102v34M36 102v28" stroke="#e3263a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Petal({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <path d="M10 1c4 3 6 7 4 12-1 3-3 5-4 6-1-1-3-3-4-6C4 8 6 4 10 1Z" fill="#ffb7c5" opacity=".85" />
    </svg>
  );
}

function Burst({ size }: { size: number }) {
  const rays = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden>
      {rays.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <line x1="0" y1="-14" x2="0" y2="-40" stroke="#f2c14e" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <circle cx="0" cy="-44" r="2" fill="#ffe08a" />
        </g>
      ))}
    </svg>
  );
}

export function FestiveBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,#9e1420_0%,#5c0a12_38%,#2a070b_70%,#1c0507_100%)]" />
      {/* lattice pattern */}
      <div className="absolute inset-0 opacity-[0.07] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><path d=%22M0 24h12V12h24v24H12V24M36 24h12M24 0v12M24 36v12%22 fill=%22none%22 stroke=%22%23f2c14e%22 stroke-width=%221.5%22/></svg>')]" />
      {BURSTS.map((b, i) => (
        <div key={i} className="firework absolute" style={{ top: b.t, left: b.l, animationDelay: b.delay }}>
          <Burst size={b.s} />
        </div>
      ))}
      <CloudScroll className="absolute top-[18%] -left-10 w-64 opacity-30 sm:w-96" />
      <CloudScroll className="absolute top-[55%] -right-10 w-64 opacity-25 sm:w-96" flip />
      <Lantern className="absolute top-0 left-[3%] hidden w-10 opacity-90 md:block" />
      <Lantern className="absolute top-0 right-[3%] hidden w-12 opacity-90 md:block" delay="1.2s" />
      {PETALS.map((p, i) => (
        <div key={i} className="petal absolute top-0" style={{ left: p.l, animationDuration: p.d, animationDelay: p.delay }}>
          <Petal size={p.s} />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1c0507] to-transparent" />
    </div>
  );
}
