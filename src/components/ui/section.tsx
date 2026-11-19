import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Small gold flourish used beside section headings. */
export function Flourish({ flip = false, className = "w-10 sm:w-16" }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 80 16" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden fill="none">
      <path d="M0 8h52c6 0 8-6 14-6 5 0 7 4 4 7-2 2-6 1-6-2" stroke="#2fc6c8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M74 8l3-3 3 3-3 3Z" fill="#2fc6c8" />
    </svg>
  );
}

export function SectionHeader({ title, href, icon, kicker }: { title: string; href?: string; icon?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="mb-1 text-xs font-medium text-neon">{kicker}</p>}
        <h2 className="heading flex items-center gap-2 text-2xl text-white sm:text-3xl">
          {title} {icon}
        </h2>
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#24282c] px-4 py-1.5 text-xs font-medium text-[#c9d1d8] shadow-[4px_4px_10px_-4px_rgb(0_0_0/0.7)] transition hover:text-neon">
          View all <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="heading text-3xl text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
