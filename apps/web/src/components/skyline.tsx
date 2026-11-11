/**
 * Original Victoria-Harbour-inspired skyline drawn in SVG (no photographs, no third-party artwork).
 * Colours come from theme tokens so the hero works in both themes.
 */
export function Skyline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={className} focusable="false">
      <rect width="1200" height="320" fill="none" />
      {/* harbour water line */}
      <rect x="0" y="282" width="1200" height="38" style={{ fill: "var(--skyline)" }} opacity="0.35" />
      <g style={{ fill: "var(--skyline)" }}>
        <rect x="20" y="200" width="60" height="120" />
        <rect x="90" y="170" width="44" height="150" />
        <rect x="140" y="210" width="70" height="110" />
        <rect x="220" y="150" width="50" height="170" />
        <rect x="280" y="190" width="64" height="130" />
        <rect x="350" y="120" width="40" height="200" />
        <rect x="396" y="168" width="58" height="152" />
        <rect x="460" y="92" width="34" height="228" />
        <polygon points="460,92 477,50 494,92" />
        <rect x="500" y="180" width="72" height="140" />
        <rect x="580" y="140" width="48" height="180" />
        <rect x="634" y="200" width="60" height="120" />
        <rect x="700" y="110" width="44" height="210" />
        <rect x="750" y="170" width="78" height="150" />
        <rect x="834" y="130" width="52" height="190" />
        <rect x="892" y="190" width="66" height="130" />
        <rect x="964" y="150" width="46" height="170" />
        <rect x="1016" y="200" width="60" height="120" />
        <rect x="1082" y="170" width="70" height="150" />
      </g>
      {/* gold window lights */}
      <g style={{ fill: "var(--gold)" }} opacity="0.55">
        {[[104, 190], [112, 230], [232, 170], [360, 150], [472, 120], [510, 200], [594, 170], [712, 140], [760, 190], [846, 160], [906, 210], [976, 180]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="4" height="4" />
        ))}
      </g>
      {/* red accent beacon */}
      <circle cx="477" cy="50" r="3" style={{ fill: "var(--primary)" }} />
    </svg>
  );
}
