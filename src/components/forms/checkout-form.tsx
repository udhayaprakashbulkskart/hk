"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CreditCard, Lock, ShieldCheck, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { FormError, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useApiForm } from "./use-api-form";
import { openRazorpay } from "./razorpay";

type Result = { kind: "paid"; orderNumber: string } | { kind: "razorpay"; orderNumber: string; keyId: string; razorpayOrderId: string; amount: number; currency: string };

export function CheckoutForm(props: {
  total: number; walletBalance: number; razorpayEnabled: boolean; defaultPlayerId: string; defaultGame: "BGMI" | "PUBG_MOBILE";
  productId?: string; quantity?: number; user: { name: string; email: string; phone?: string | null };
}) {
  const canWallet = props.walletBalance >= props.total;
  const [provider, setProvider] = useState<"WALLET" | "RAZORPAY">(props.razorpayEnabled && !canWallet ? "RAZORPAY" : "WALLET");
  const [stage, setStage] = useState<string | null>(null);
  const { pending, error, fields, submit, setError } = useApiForm();
  const router = useRouter();
  const busy = pending || !!stage;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await submit<Result>("/api/checkout", { provider, gamePlayerId: f.get("gamePlayerId"), game: f.get("game"), productId: props.productId, quantity: props.quantity });
    if (!res) return;
    if (res.kind === "paid") return router.push(`/orders/${res.orderNumber}?placed=1`);
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
      router.push(`/orders/${res.orderNumber}?placed=1`);
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
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="heading text-lg">Payment</h2>
        <PayOption selected={provider} onSelect={setProvider} value="WALLET" title={`Wallet · ${formatINR(props.walletBalance)}`} sub={canWallet ? "Pay instantly from your balance" : "Insufficient balance — top up or pay online"} Icon={Wallet} disabled={!canWallet} />
        <PayOption selected={provider} onSelect={setProvider} value="RAZORPAY" title="UPI, Cards, Netbanking" sub={props.razorpayEnabled ? "Secured by Razorpay" : "Online payments are not configured on this server"} Icon={CreditCard} disabled={!props.razorpayEnabled} />
      </section>
      <button className="btn-primary w-full py-3.5 text-base" disabled={busy || (!canWallet && !props.razorpayEnabled)}>
        {busy ? <Spinner /> : <Lock className="size-4" />} {stage ?? `Pay ${formatINR(props.total)}`}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5 text-neon" /> Seller is paid only after you confirm delivery.</p>
    </form>
  );
}

function PayOption({ value, selected, onSelect, title, sub, Icon, disabled }: { value: "WALLET" | "RAZORPAY"; selected: string; onSelect: (v: "WALLET" | "RAZORPAY") => void; title: string; sub: string; Icon: typeof Wallet; disabled?: boolean }) {
  return (
    <label className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition", selected === value ? "border-neon bg-neon/10 shadow-neon" : "border-line hover:border-zinc-500", disabled && "cursor-not-allowed opacity-50")}>
      <input type="radio" name="provider" value={value} checked={selected === value} disabled={disabled} onChange={() => onSelect(value)} className="accent-[#f5b301]" />
      <Icon className="size-5 text-neon" />
      <span className="flex-1"><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-muted">{sub}</span></span>
    </label>
  );
}
