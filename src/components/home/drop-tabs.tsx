"use client";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

/** Filter-tab pills over pre-rendered product grids (like "New Drops / Most Viewed / Bids"). */
export function DropTabs({ tabs }: { tabs: { key: string; label: string; href: string; content: React.ReactNode }[] }) {
  const [k, setK] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === k) ?? tabs[0];
  return (
    <section className="reveal">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={t.key === current.key} onClick={() => setK(t.key)} className={clsx("chip", t.key === current.key && "chip-active")}>
              {t.label}
            </button>
          ))}
        </div>
        <Link href={`/marketplace?sort=price_desc`} className="chip">
          Price: High to Low <ChevronDown className="size-3.5" />
        </Link>
      </div>
      <div key={current.key} role="tabpanel" className="page-enter">
        {current.content}
      </div>
    </section>
  );
}
