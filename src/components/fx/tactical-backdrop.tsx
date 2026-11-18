/**
 * Static "tactical map" backdrop: gunmetal base, faint map grid, topographic contour lines in two
 * corners and a soft amber glow. Purely decorative, no animation (zero cost on phones).
 */
function Contours({ className, seed }: { className: string; seed: number }) {
  const rings = Array.from({ length: 14 }, (_, i) => {
    const r = 30 + i * 22;
    const pts = Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      const wobble = 1 + 0.12 * Math.sin(a * 3 + seed + i * 0.35) + 0.06 * Math.cos(a * 5 + seed * 2);
      return [300 + Math.cos(a) * r * wobble, 300 + Math.sin(a) * r * wobble * 0.82];
    });
    return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";
  });
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <g fill="none" stroke="#f5b301" strokeLinejoin="round">
        {rings.map((d, i) => (
          <path key={i} d={d} strokeWidth={i % 4 === 0 ? 1.1 : 0.6} opacity={i % 4 === 0 ? 0.5 : 0.28} />
        ))}
      </g>
    </svg>
  );
}

export function TacticalBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="absolute inset-0 bg-[radial-gradient(70rem_36rem_at_50%_-10%,rgb(245_179_1/0.10),transparent_65%),radial-gradient(40rem_30rem_at_100%_100%,rgb(255_122_26/0.06),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgb(255_255_255/.7)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.7)_1px,transparent_1px)] [background-size:56px_56px]" />
      <Contours seed={1} className="absolute -top-40 -right-40 w-[720px] max-w-none opacity-[0.22]" />
      <Contours seed={4} className="absolute -bottom-56 -left-48 w-[680px] max-w-none opacity-[0.16]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgb(0_0_0/0.5)_100%)]" />
    </div>
  );
}
