import Link from "next/link";
import clsx from "clsx";

export function StatusTabs({ base, tabs, current, extra = "" }: { base: string; tabs: readonly string[]; current: string; extra?: string }) {
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {tabs.map((t) => (
        <Link key={t} href={`${base}?status=${t}${extra}`} className={clsx("chip shrink-0", current === t && "chip-active")}>
          {t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
        </Link>
      ))}
    </div>
  );
}

export function pick<T extends string>(v: unknown, opts: readonly T[], fallback: T): T {
  return opts.find((o) => o === v) ?? fallback;
}
