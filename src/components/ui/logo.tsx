import Link from "next/link";

/** Original ZYNOFLIX mark: gold medallion with a parachute-drop chevron — not a game publisher logo. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="dz-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset=".5" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#a8741f" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#8b0f1a" stroke="url(#dz-g)" strokeWidth="3" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="#f2c14e" strokeWidth="1" strokeDasharray="2 3" opacity=".7" />
      <path d="M16 26c4-8 28-8 32 0Z" fill="url(#dz-g)" />
      <path d="M17 27l15 13 15-13M32 40v6" stroke="#f2c14e" strokeWidth="1.6" fill="none" />
      <path d="M26 45h12l-6 7Z" fill="url(#dz-g)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ZYNOFLIX STORE home">
      <LogoMark />
      <span className="font-display text-lg leading-none font-extrabold tracking-[0.12em]">
        <span className="gold-text">ZYNOFLIX</span> <span className="text-[#ffe9b8]">STORE</span>
      </span>
    </Link>
  );
}
