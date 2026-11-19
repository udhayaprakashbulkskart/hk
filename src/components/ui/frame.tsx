/** Gold ornamental frame (corner brackets + inner hairline) used for featured panels. */
export function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const corner = "pointer-events-none absolute size-6 border-neon";
  return (
    <div className={`relative rounded-2xl border border-neon/50 bg-gradient-to-b from-[#4a0d14]/90 to-[#22070a]/95 p-1 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)] ${className}`}>
      <span className={`${corner} -top-px -left-px rounded-tl-2xl border-t-2 border-l-2`} />
      <span className={`${corner} -top-px -right-px rounded-tr-2xl border-t-2 border-r-2`} />
      <span className={`${corner} -bottom-px -left-px rounded-bl-2xl border-b-2 border-l-2`} />
      <span className={`${corner} -right-px -bottom-px rounded-br-2xl border-r-2 border-b-2`} />
      <div className="h-full rounded-xl border border-neon/20">{children}</div>
    </div>
  );
}
