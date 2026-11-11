import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page";
import { NAV } from "@/lib/nav";

export default function MorePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="More" description="Everything else in HK FinHub." />
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {NAV.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center justify-between gap-3 px-4 hover:bg-[var(--secondary)]">
              <span className="flex items-center gap-3"><Icon className="size-5 text-[var(--gold)]" aria-hidden="true" />{label}</span>
              <ChevronRight className="size-4 text-[var(--muted-foreground)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
