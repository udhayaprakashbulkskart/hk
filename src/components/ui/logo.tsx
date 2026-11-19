import Link from "next/link";

/** Original ZYNOFLIX mark: teal-ringed medallion with a parachute-drop chevron — not a game publisher logo. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="dz-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ef0ef" />
          <stop offset=".5" stopColor="#2fc6c8" />
          <stop offset="1" stopColor="#14878a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#2a2e33" stroke="url(#dz-g)" strokeWidth="3" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="#2fc6c8" strokeWidth="1" strokeDasharray="2 3" opacity=".7" />
      <path d="M16 26c4-8 28-8 32 0Z" fill="url(#dz-g)" />
      <path d="M17 27l15 13 15-13M32 40v6" stroke="#2fc6c8" strokeWidth="1.6" fill="none" />
      <path d="M26 45h12l-6 7Z" fill="url(#dz-g)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ZYNOFLIX STORE home">
      <LogoMark />
      <span className="font-display text-lg leading-none font-semibold tracking-[0.08em]">
        <span className="text-white">ZYNOFLIX</span> <span className="font-light text-neon">STORE</span>
      </span>
    </Link>
  );
}
