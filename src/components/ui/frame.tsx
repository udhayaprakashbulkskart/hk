/** Raised panel used for featured blocks (soft neumorphic card with an inner hairline). */
export function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-1 ${className}`}>
      <div className="h-full rounded-[20px] border border-white/[0.04]">{children}</div>
    </div>
  );
}
