"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { RARITY_LABEL, SORT_OPTIONS } from "@/lib/constants";
import { Spinner } from "@/components/ui/states";

type Cat = { slug: string; name: string };

/** Search, category chips, sorting and a filter sheet — all state lives in the URL. */
export function MarketFilters({ categories, showCategories = true }: { categories: Cat[]; showCategories?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const q = sp.get("q") ?? "";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.push(`${pathname}?${next}`, { scroll: false }));
  };
  const cat = sp.get("category");
  const rarities = (sp.get("rarity") ?? "").split(",").filter(Boolean);
  const activeCount = ["rarity", "game", "min", "max", "level"].filter((k) => sp.get(k)).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            update({ q: value || null });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
          <input key={q} name="q" defaultValue={q} placeholder="Search skins, outfits, weapons…" aria-label="Search products" className="input rounded-full py-3 pl-10" />
        </form>
        <button type="button" onClick={() => setOpen(true)} className="btn-outline relative rounded-full px-4" aria-label="Filters">
          <SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-neon text-[10px] font-bold">{activeCount}</span>}
        </button>
        <select aria-label="Sort by" value={sp.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value })} className="input hidden w-48 rounded-full sm:block">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {showCategories && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          <button type="button" onClick={() => update({ category: null })} className={clsx("chip shrink-0", !cat && "chip-active")}>All</button>
          {categories.map((c) => (
            <button type="button" key={c.slug} onClick={() => update({ category: c.slug })} className={clsx("chip shrink-0", cat === c.slug && "chip-active")}>
              {c.name}
            </button>
          ))}
          {pending && <Spinner className="size-4 self-center" />}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <FilterSheet
            initial={{ rarities, game: sp.get("game") ?? "", min: sp.get("min") ?? "", max: sp.get("max") ?? "", level: sp.get("level") ?? "", sort: sp.get("sort") ?? "newest" }}
            onClose={() => setOpen(false)}
            onApply={(v) => {
              update({ rarity: v.rarities.join(",") || null, game: v.game || null, min: v.min || null, max: v.max || null, level: v.level || null, sort: v.sort });
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

type FV = { rarities: string[]; game: string; min: string; max: string; level: string; sort: string };

function FilterSheet({ initial, onApply, onClose }: { initial: FV; onApply: (v: FV) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const invalid = v.min && v.max && Number(v.min) > Number(v.max);
  return (
    <div role="dialog" aria-modal aria-label="Filters" className="card relative max-h-[90dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-b-none p-5 sm:rounded-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="heading text-xl">Filters</h2>
        <button onClick={onClose} aria-label="Close filters" className="btn-ghost p-2"><X className="size-5" /></button>
      </div>
      <fieldset className="mb-5">
        <legend className="label">Rarity</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(RARITY_LABEL).map(([k, label]) => {
            const on = v.rarities.includes(k);
            return (
              <button type="button" key={k} aria-pressed={on} onClick={() => setV({ ...v, rarities: on ? v.rarities.filter((r) => r !== k) : [...v.rarities, k] })} className={clsx("chip", on && "chip-active")}>
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="mb-5">
        <legend className="label">Game</legend>
        <div className="flex flex-wrap gap-2">
          {[["", "Any"], ["BGMI", "BGMI"], ["PUBG_MOBILE", "PUBG Mobile"]].map(([val, label]) => (
            <button type="button" key={val} aria-pressed={v.game === val} onClick={() => setV({ ...v, game: val })} className={clsx("chip", v.game === val && "chip-active")}>{label}</button>
          ))}
        </div>
      </fieldset>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Min price (₹)</span>
          <input inputMode="numeric" className="input" value={v.min} onChange={(e) => setV({ ...v, min: e.target.value.replace(/\D/g, "") })} />
        </label>
        <label className="block">
          <span className="label">Max price (₹)</span>
          <input inputMode="numeric" className="input" aria-invalid={!!invalid} value={v.max} onChange={(e) => setV({ ...v, max: e.target.value.replace(/\D/g, "") })} />
        </label>
        {invalid && <p className="col-span-2 -mt-1 text-xs text-neon-soft">Min price can&apos;t exceed max price</p>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Min weapon level</span>
          <select className="input" value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5, 6, 7].map((l) => <option key={l} value={l}>Lv.{l}+</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Sort by</span>
          <select className="input" value={v.sort} onChange={(e) => setV({ ...v, sort: e.target.value })}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-outline flex-1" onClick={() => setV({ rarities: [], game: "", min: "", max: "", level: "", sort: "newest" })}>Reset</button>
        <button type="button" className="btn-primary flex-1" disabled={!!invalid} onClick={() => onApply(v)}>Show results</button>
      </div>
    </div>
  );
}
