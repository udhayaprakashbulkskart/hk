import { Info } from "lucide-react";

/** Always-visible notice: the app is a sandbox preview and figures are sample data. */
export function SandboxBanner() {
  return (
    <div role="note" className="flex items-center gap-2 border-t border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-1.5 text-xs text-[var(--foreground)] sm:px-6">
      <Info className="size-3.5 shrink-0 text-[var(--gold)]" aria-hidden="true" />
      <span>Sandbox preview. Figures are sample data. Live payments and trading are not yet enabled.</span>
    </div>
  );
}
