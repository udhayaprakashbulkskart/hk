import Link from "next/link";
import { AlertTriangle, PackageOpen } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-line bg-panel-2 text-neon">
        <PackageOpen className="size-7" />
      </div>
      <h3 className="heading text-lg">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", body, retry }: { title?: string; body?: string; retry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-neon/40 px-6 py-14 text-center">
      <AlertTriangle className="size-9 text-neon" />
      <h3 className="heading text-lg">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {retry && (
        <button onClick={retry} className="btn-outline mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden className={`${className} inline-block animate-spin rounded-full border-2 border-white/30 border-t-white`} />;
}

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden p-2">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2 p-2 pt-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-5 w-1/3" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
