import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="heading flex items-center gap-2 text-xl sm:text-2xl">
        {title} {icon}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-neon hover:text-neon-soft">
          View all <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="heading text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
