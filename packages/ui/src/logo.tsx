import { cn } from "./cn";

/** HK FinHub wordmark. An original mark: a red tile with a gold harbour-line motif. Not a bank emblem. */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M6 20 Q 16 10 26 20" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M9 24.5 H23" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      </svg>
      {showWordmark ? (
        <span className="text-base font-semibold tracking-tight">
          HK <span className="text-[var(--gold)]">FinHub</span>
        </span>
      ) : null}
    </span>
  );
}
