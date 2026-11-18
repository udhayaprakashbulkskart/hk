"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { FormError, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiForm } from "./use-api-form";
import { openRazorpay } from "./razorpay";

export function TopupForm({ enabled }: { enabled: boolean }) {
  const { pending, error, fields, submit, setError } = useApiForm();
  const [stage, setStage] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  if (!enabled) return <p className="text-sm text-muted">Online top-ups are not configured on this server yet.</p>;
  return (
    <form noValidate className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const amount = new FormData(e.currentTarget).get("amount");
      const res = await submit<{ keyId: string; razorpayOrderId: string; amount: number; currency: string }>("/api/wallet/topup", { amount });
      if (!res) return;
      setStage("Waiting for payment…");
      try {
        const r = await openRazorpay({ ...res, description: "Wallet top-up" });
        if (!r) return setError("Top-up cancelled.");
        if ("failed" in r) return setError(`Payment failed: ${r.failed}`);
        setStage("Verifying…");
        const v = await api("/api/payments/razorpay/verify", { body: r });
        if (!v.ok) return setError(v.error);
        toast("success", "Wallet topped up");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment error");
      } finally {
        setStage(null);
      }
    }}>
      <FormError message={error} />
      <Input label="Amount (₹)" name="amount" type="number" min={100} max={50000} required error={fields.amount} placeholder="500" />
      <button className="btn-primary w-full" disabled={pending || !!stage}>{(pending || stage) && <Spinner />} {stage ?? "Add money"}</button>
    </form>
  );
}

export function WithdrawForm({ defaultUpi, max }: { defaultUpi?: string | null; max: number }) {
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  const toast = useToast();
  return (
    <form noValidate className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      if (await submit("/api/wallet/withdraw", { amount: f.get("amount"), upiId: f.get("upiId") })) {
        toast("success", "Withdrawal requested — usually processed within 1–2 working days");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    }}>
      <FormError message={error} />
      <Input label="Amount (₹)" name="amount" type="number" min={100} max={Math.floor(max / 100)} required error={fields.amount} hint={`Available: ₹${(max / 100).toLocaleString("en-IN")} · min ₹100`} />
      <Input label="UPI ID" name="upiId" required defaultValue={defaultUpi ?? ""} error={fields.upiId} />
      <button className="btn-outline w-full" disabled={pending || max < 10000}>{pending && <Spinner />} Request withdrawal</button>
    </form>
  );
}
