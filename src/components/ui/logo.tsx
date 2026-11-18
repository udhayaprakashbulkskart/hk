import Link from "next/link";

/** Original helmet mark — not a game publisher logo. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg-h" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5b301" />
          <stop offset=".55" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <path d="M32 6C17 6 7 17 7 32v9c0 4 5 8 12 9l2-6h22l2 6c7-1 12-5 12-9v-9C57 17 47 6 32 6Z" fill="url(#lg-h)" />
      <path d="M13 27h38l-2 11H15Z" fill="#05060b" />
      <path d="M17 30h30l-1 5H18Z" fill="#f5b301" opacity=".95" />
      <path d="M28 8h8l-1 13h-6Z" fill="#fff" opacity=".25" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="PUBG Store home">
      <LogoMark />
      <span className="font-display text-lg leading-none font-extrabold tracking-[0.18em]">
        <span className="text-white">PUBG</span> <span className="text-neon">STORE</span>
      </span>
    </Link>
  );
}
