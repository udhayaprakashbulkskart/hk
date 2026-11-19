"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Coins, Info } from "lucide-react";
import { formatINR } from "@/lib/money";

type Pack = { id: string; ucAmount: number; price: number; compareAtPrice: number | null; game: "PUBG_MOBILE" | "BGMI" | "BOTH" };
type GameKey = "PUBG_MOBILE" | "BGMI";
const GAMES: { key: GameKey; label: string; note: string }[] = [
  { key: "PUBG_MOBILE", label: "PUBG Mobile", note: "Global version" },
  { key: "BGMI", label: "BGMI", note: "Battlegrounds Mobile India" },
];

/** UC top-up builder: game tabs → package → Player ID + nickname → summary → checkout. */
export function UcTopup({ packs, defaultGame, defaultPlayerId }: { packs: Pack[]; defaultGame: GameKey; defaultPlayerId: string }) {
  const [game, setGame] = useState<GameKey>(defaultGame);
  const list = packs.filter((p) => p.game === "BOTH" || p.game === game);
  const [packId, setPackId] = useState<string | null>(null);
  const pack = list.find((p) => p.id === packId) ?? null;
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [nickname, setNickname] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const best = list.length ? list.reduce((b, p) => (p.ucAmount / p.price > b.ucAmount / b.price ? p : b)) : null;

  const proceed = () => {
    if (!pack) return setErr("Choose a UC package");
    if (!/^\d{6,15}$/.test(playerId.trim())) return setErr("Enter a valid numeric Player ID (6–15 digits)");
    if (nickname.trim().length < 2) return setErr("Enter your in-game nickname");
    const q = new URLSearchParams({ product: pack.id, quantity: "1", game, pid: playerId.trim(), nick: nickname.trim() });
    router.push(`/checkout?${q}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section>
          <h2 className="heading mb-3 text-lg text-[#f2f5f7]">1 · Choose your game</h2>
          <div role="tablist" className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => (
              <button key={g.key} role="tab" aria-selected={game === g.key} onClick={() => { setGame(g.key); setPackId(null); }}
                className={clsx("rounded-xl border p-4 text-left transition", game === g.key ? "border-neon bg-gradient-to-b from-[#3b4148] to-[#2a2e33] shadow-neon" : "border-neon/25 bg-[#1f2226] hover:border-neon/60")}>
                <span className="heading block text-lg text-[#f2f5f7]">{g.label}</span>
                <span className="text-xs text-muted">{g.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="heading mb-3 text-lg text-[#f2f5f7]">2 · Select a package</h2>
          {list.length === 0 ? (
            <p className="card p-4 text-sm text-muted">No packages for this game right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => { setPackId(p.id); setErr(null); }} aria-pressed={pack?.id === p.id}
                  className={clsx("relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition", pack?.id === p.id ? "border-neon bg-gradient-to-b from-[#3b4148] to-[#2a2e33] shadow-neon" : "border-neon/25 bg-[#1f2226] hover:-translate-y-0.5 hover:border-neon/60")}>
                  {best?.id === p.id && <span className="absolute -top-2.5 rounded bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">Best value</span>}
                  <span className="grid size-12 place-items-center rounded-full border border-[#8ef0ef]/60 bg-gradient-to-b from-[#8ef0ef] to-[#1a9ea2] text-[#062224]"><Coins className="size-6" /></span>
                  <span className="heading text-xl text-[#f2f5f7]">{p.ucAmount.toLocaleString("en-IN")} UC</span>
                  <span className="font-bold text-neon">{formatINR(p.price)}</span>
                  {p.compareAtPrice && p.compareAtPrice > p.price && <span className="text-[11px] text-[#8c959e] line-through">{formatINR(p.compareAtPrice)}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="heading text-lg text-[#f2f5f7]">3 · Player details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Player ID</span>
              <input className="input" inputMode="numeric" value={playerId} onChange={(e) => setPlayerId(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 5123456789" maxLength={15} />
            </label>
            <label className="block">
              <span className="label">In-game nickname</span>
              <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="As shown on your profile" maxLength={40} />
            </label>
          </div>
          <p className="flex gap-2 text-xs text-muted">
            <Info className="size-4 shrink-0 text-neon" />
            Nickname check: we don&apos;t have an official lookup, so the nickname you enter is shown back to you for confirmation and recorded on the order for the fulfilment team. Only your Player ID is needed — never your password or OTP.
          </p>
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-20">
        <h2 className="heading text-lg text-neon">Order summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Game</dt><dd>{GAMES.find((g) => g.key === game)?.label}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Package</dt><dd>{pack ? `${pack.ucAmount.toLocaleString("en-IN")} UC` : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Player ID</dt><dd className="font-mono">{playerId || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Nickname</dt><dd className="truncate">{nickname || "—"}</dd></div>
          <div className="flex justify-between border-t border-neon/20 pt-2 font-display text-lg font-bold"><dt>Total</dt><dd className="text-neon">{pack ? formatINR(pack.price) : "—"}</dd></div>
        </dl>
        {err && <p className="text-xs text-red-400" role="alert">{err}</p>}
        <button type="button" onClick={proceed} className="btn-primary w-full py-3">Continue to payment <ArrowRight className="size-4" /></button>
        <p className="text-center text-[11px] text-muted">Coupons can be applied on the next step. Track delivery in My Orders.</p>
      </aside>
    </div>
  );
}
