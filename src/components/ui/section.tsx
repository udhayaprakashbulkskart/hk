import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Small gold flourish used either side of festival headings. */
export function Flourish({ flip = false, className = "w-10 sm:w-16" }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 80 16" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden fill="none">
      <path d="M0 8h52c6 0 8-6 14-6 5 0 7 4 4 7-2 2-6 1-6-2" stroke="#f2c14e" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M74 8l3-3 3 3-3 3Z" fill="#f2c14e" />
    </svg>
  );
}

export function SectionHeader({ title, href, icon, kicker }: { title: string; href?: string; icon?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="mb-1 text-[11px] font-semibold tracking-[0.25em] text-mint uppercase">{kicker}</p>}
        <h2 className="heading flex items-center gap-2 text-xl sm:text-3xl">
          <Flourish className="hidden w-8 sm:block" />
          <span className="gold-text">{title}</span> {icon}
        </h2>
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-0.5 rounded-full border border-neon/50 px-3 py-1 text-xs font-semibold text-neon transition hover:bg-neon hover:text-[#3a0a0e]">
          View all <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-neon/25 pb-4">
      <div>
        <h1 className="heading flex items-center gap-3 text-2xl sm:text-4xl">
          <span className="gold-text">{title}</span>
          <Flourish className="hidden w-14 sm:block" />
        </h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
