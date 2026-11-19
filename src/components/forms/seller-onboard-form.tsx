"use client";
import { useRouter } from "next/navigation";
import { FormError, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useApiForm } from "./use-api-form";

export function SellerOnboardForm({ defaults }: { defaults?: { storeName?: string; legalName?: string; payoutUpi?: string | null; bio?: string | null } }) {
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = Object.fromEntries(["storeName", "legalName", "panLast4", "payoutUpi", "bio"].map((k) => [k, String(f.get(k) ?? "")]));
        if (await submit("/api/seller/onboard", { ...body, agree: f.get("agree") === "on" })) router.refresh();
      }}
    >
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Store name" name="storeName" required defaultValue={defaults?.storeName} error={fields.storeName} hint="Shown to buyers" />
        <Input label="Legal name (as on PAN)" name="legalName" required defaultValue={defaults?.legalName} error={fields.legalName} />
        <Input label="PAN — last 4 characters" name="panLast4" required maxLength={4} error={fields.panLast4} hint="We only store the last 4 characters" />
        <Input label="Payout UPI ID" name="payoutUpi" required defaultValue={defaults?.payoutUpi ?? ""} error={fields.payoutUpi} placeholder="name@okbank" />
      </div>
      <Textarea label="About your store (optional)" name="bio" maxLength={300} defaultValue={defaults?.bio ?? ""} error={fields.bio} />
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" name="agree" className="mt-1 accent-[#f2c14e]" />
        <span>I will only list items transferable through the game&apos;s official gifting or redeem systems. I will never sell accounts or ask buyers for passwords or OTPs.</span>
      </label>
      {fields.agree && <p className="-mt-2 text-xs text-neon-soft">{fields.agree}</p>}
      <button className="btn-primary w-full py-3 sm:w-auto" disabled={pending}>
        {pending && <Spinner />} Submit for verification
      </button>
    </form>
  );
}
