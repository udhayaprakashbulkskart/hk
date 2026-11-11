import type { ReactNode } from "react";
import { cn } from "@hkfinhub/ui";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{body}</p>
    </div>
  );
}

/** Keyboard-reachable tab strip implemented with links so each tab is a real, shareable URL. */
export function TabLinks({ tabs, active, basePath }: { tabs: { key: string; label: string }[]; active: string; basePath: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-1">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={`${basePath}?tab=${t.key}`}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors",
            active === t.key ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
