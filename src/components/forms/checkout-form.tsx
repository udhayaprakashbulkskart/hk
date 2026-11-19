"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CreditCard, Lock, ShieldCheck, Tag, Wallet, X } from "lucide-react";
import { api } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { FormError, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useApiForm } from "./use-api-form";
import { openRazorpay } from "./razorpay";

type Result = { kind: "paid"; orderNumber: string } | { kind: "razorpay"; orderNumber: string; keyId: string; razorpayOrderId: string; amount: number; currency: string };

type Promo = { code: string; description: string | null; discount: number };

export function CheckoutForm(props: {
  subtotal: number; walletBalance: number; razorpayEnabled: boolean; defaultPlayerId: string; defaultGame: "BGMI" | "PUBG_MOBILE";
  productId?: string; quantity?: number; needsNickname?: boolean; defaultNickname?: string; user: { name: string; email: string; phone?: string | null };
}) {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [code, setCode] = useState("");
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const total = props.subtotal - (promo?.discount ?? 0);
  const canWallet = props.walletBalance >= total;
  const [provider, setProvider] = useState<"WALLET" | "RAZORPAY">(props.razorpayEnabled && props.walletBalance < props.subtotal ? "RAZORPAY" : "WALLET");
  const method = provider === "WALLET" && !canWallet && props.razorpayEnabled ? "RAZORPAY" : provider;
  const [stage, setStage] = useState<string | null>(null);
  const { pending, error, fields, submit, setError } = useApiForm();
  const router = useRouter();
  const busy = pending || !!stage;

  async function applyCoupon() {
    if (!code.trim()) return;
    setApplying(true);
    setPromoErr(null);
    const r = await api<Promo>("/api/coupons/validate", { body: { code, productId: props.productId, quantity: props.quantity } });
    setApplying(false);
    if (!r.ok) return setPromoErr(r.fields?.couponCode ?? r.error);
    setPromo(r.data);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (props.needsNickname && !f.get("nicknameConfirm")) return setError("Please confirm your Player ID and nickname are correct — UC can't be reversed once delivered.");
    const res = await submit<Result>("/api/checkout", {
      provider: method, gamePlayerId: f.get("gamePlayerId"), game: f.get("game"), productId: props.productId, quantity: props.quantity,
      couponCode: promo?.code, gameNickname: props.needsNickname ? f.get("gameNickname") : undefined,
    });
    if (!res) return;
    if (res.kind === "paid") return router.push(`/payment/success?order=${res.orderNumber}`);
    try {
      setStage("Waiting for payment…");
      const r = await openRazorpay({ keyId: res.keyId, razorpayOrderId: res.razorpayOrderId, amount: res.amount, currency: res.currency, description: `Order ${res.orderNumber}`, prefill: { name: props.user.name, email: props.user.email, contact: props.user.phone ?? undefined } });
      if (!r) {
        setStage(null);
        return setError("Payment cancelled. Your order is held for 30 minutes — you can retry from My Orders.");
      }
      if ("failed" in r) {
        setStage(null);
        return setError(`Payment failed: ${r.failed}`);
      }
      setStage("Verifying payment…");
      const v = await api("/api/payments/razorpay/verify", { body: r });
      setStage(null);
      if (!v.ok) return setError(`${v.error}. If money was debited, it will be confirmed automatically or refunded.`);
      router.push(`/payment/success?order=${res.orderNumber}`);
    } catch (err) {
      setStage(null);
      setError(err instanceof Error ? err.message : "Payment error");
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />
      <section className="space-y-3">
        <h2 className="heading text-lg">Delivery details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Player ID (in-game character ID)" name="gamePlayerId" required inputMode="numeric" defaultValue={props.defaultPlayerId} error={fields.gamePlayerId} hint="Find it on your in-game profile. We never need your password or OTP." />
          <Select label="Game" name="game" defaultValue={props.defaultGame} error={fields.game} options={[{ value: "BGMI", label: "BGMI" }, { value: "PUBG_MOBILE", label: "PUBG Mobile" }]} />
          {props.needsNickname && (
            <Input label="In-game nickname" name="gameNickname" required defaultValue={props.defaultNickname} error={fields.gameNickname} hint="Shown on your profile next to your Player ID." />
          )}
        </div>
        {props.needsNickname && (
          <label className="flex items-start gap-2 rounded-lg border border-neon/30 bg-[#17191c]/60 p-3 text-xs text-[#c9d1d8]">
            <input type="checkbox" name="nicknameConfirm" className="mt-0.5 accent-[#2fc6c8]" />
            <span>I&apos;ve checked that this Player ID belongs to the nickname above. ZYNOFLIX can&apos;t look nicknames up automatically, so please double-check — UC sent to a wrong ID can&apos;t be recovered.</span>
          </label>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="heading text-lg">Coupon</h2>
        {promo ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <span className="flex items-center gap-2"><Tag className="size-4 text-success" /> <b>{promo.code}</b> — {promo.description ?? "applied"} (−{formatINR(promo.discount)})</span>
            <button type="button" onClick={() => setPromo(null)} aria-label="Remove coupon" className="btn-ghost p-1"><X className="size-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }} placeholder="Enter coupon code" aria-label="Coupon code" aria-invalid={!!promoErr} className="input uppercase" maxLength={32} />
            <button type="button" onClick={applyCoupon} disabled={applying || !code.trim()} className="btn-outline shrink-0">{applying ? <Spinner /> : "Apply"}</button>
          </div>
        )}
        {(promoErr || fields.couponCode) && <p className="text-xs text-red-400">{promoErr ?? fields.couponCode}</p>}
      </section>
      <section className="space-y-3">
        <h2 className="heading text-lg">Payment</h2>
        <PayOption selected={method} onSelect={setProvider} value="WALLET" title={`Wallet · ${formatINR(props.walletBalance)}`} sub={canWallet ? "Pay instantly from your balance" : "Insufficient balance — top up or pay online"} Icon={Wallet} disabled={!canWallet} />
        <PayOption selected={method} onSelect={setProvider} value="RAZORPAY" title="UPI, Cards, Netbanking" sub={props.razorpayEnabled ? "Secured by Razorpay" : "Online payments are not configured on this server"} Icon={CreditCard} disabled={!props.razorpayEnabled} />
      </section>
      <dl className="space-y-1.5 rounded-lg border border-neon/25 bg-[#17191c]/60 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatINR(props.subtotal)}</dd></div>
        {promo && <div className="flex justify-between text-success"><dt>Coupon {promo.code}</dt><dd>−{formatINR(promo.discount)}</dd></div>}
        <div className="flex justify-between border-t border-neon/20 pt-2 font-display text-lg font-bold"><dt>Total</dt><dd className="text-neon">{formatINR(total)}</dd></div>
      </dl>
      <button className="btn-primary w-full py-3.5 text-base" disabled={busy || (!canWallet && !props.razorpayEnabled)}>
        {busy ? <Spinner /> : <Lock className="size-4" />} {stage ?? `Pay ${formatINR(total)}`}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5 text-neon" /> Refund available if your order can&apos;t be delivered.</p>
    </form>
  );
}

function PayOption({ value, selected, onSelect, title, sub, Icon, disabled }: { value: "WALLET" | "RAZORPAY"; selected: string; onSelect: (v: "WALLET" | "RAZORPAY") => void; title: string; sub: string; Icon: typeof Wallet; disabled?: boolean }) {
  return (
    <label className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition", selected === value ? "border-neon bg-neon/10 shadow-neon" : "border-line hover:border-zinc-500", disabled && "cursor-not-allowed opacity-50")}>
      <input type="radio" name="provider" value={value} checked={selected === value} disabled={disabled} onChange={() => onSelect(value)} className="accent-[#2fc6c8]" />
      <Icon className="size-5 text-neon" />
      <span className="flex-1"><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-muted">{sub}</span></span>
    </label>
  );
}
