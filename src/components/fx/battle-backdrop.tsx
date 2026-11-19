/**
 * Graphite studio backdrop: a soft spotlight glow on dark grey with a faint teal rim light,
 * like a product-shot stage. Static (no animation) so it costs nothing on phones.
 */
export function BattleBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,#3a3f45_0%,#24282c_45%,#17191c_80%,#131517_100%)]" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.07),transparent)]" />
      <div className="absolute top-1/3 -right-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(47_198_200/0.08),transparent)]" />
      <div className="absolute -bottom-40 -left-40 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(47_198_200/0.05),transparent)]" />
    </div>
  );
}
