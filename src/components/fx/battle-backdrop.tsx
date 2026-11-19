/**
 * Battleground backdrop: deep red-to-black gradient, a faint tactical map grid with
 * circle-zone rings, and slowly rising embers. Original CSS/SVG; transform/opacity-only
 * animation so it stays cheap on high-DPI phones.
 */
const EMBERS = [
  { l: "6%", d: "11s", delay: "0s", s: 3 },
  { l: "18%", d: "14s", delay: "3s", s: 2 },
  { l: "33%", d: "12s", delay: "6s", s: 3 },
  { l: "51%", d: "16s", delay: "1s", s: 2 },
  { l: "67%", d: "13s", delay: "5s", s: 3 },
  { l: "82%", d: "15s", delay: "8s", s: 2 },
  { l: "94%", d: "12s", delay: "2s", s: 3 },
];

export function BattleBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,#8e1420_0%,#4a0a10_40%,#1e0507_75%,#120304_100%)]" />
      {/* map grid */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#f2c14e_1px,transparent_1px),linear-gradient(90deg,#f2c14e_1px,transparent_1px)] [background-size:64px_64px]" />
      {/* safe-zone rings */}
      <svg className="absolute -top-40 -right-40 size-[620px] opacity-[0.12]" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="96" stroke="#f2c14e" strokeWidth="0.6" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="62" stroke="#f2c14e" strokeWidth="0.8" />
        <circle cx="100" cy="100" r="30" stroke="#e3263a" strokeWidth="0.8" />
      </svg>
      <svg className="absolute -bottom-48 -left-48 size-[560px] opacity-[0.08]" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="96" stroke="#f2c14e" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="58" stroke="#f2c14e" strokeWidth="0.6" strokeDasharray="2 4" />
      </svg>
      {EMBERS.map((e, i) => (
        <span key={i} className="ember absolute bottom-0 rounded-full bg-[#ffb347]" style={{ left: e.l, width: e.s, height: e.s, animationDuration: e.d, animationDelay: e.delay }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#120304] to-transparent" />
    </div>
  );
}
