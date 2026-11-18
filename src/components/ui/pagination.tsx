import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    sp.set("page", String(p));
    return `${basePath}?${sp}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn-outline btn-sm" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      <span className="px-3 text-sm text-muted">
        Page <b className="text-white">{page}</b> of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn-outline btn-sm" aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
