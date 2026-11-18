"use client";
import { useState } from "react";
import { Flag } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FormError, Select, Textarea } from "@/components/ui/field";
import { useApiForm } from "./use-api-form";

const REASONS = ["Scam or fraud", "Account selling", "Asks for password/OTP", "Wrong category", "Offensive content", "Other"];

export function ReportButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-neon-soft">
        <Flag className="size-3.5" /> Report this listing
      </button>
    );
  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (await submit("/api/reports", { productId, reason: f.get("reason"), details: f.get("details") || undefined })) {
          toast("success", "Thanks — our team will review this listing");
          setOpen(false);
        }
      }}
    >
      <h3 className="font-semibold">Report listing</h3>
      <FormError message={error} />
      <Select label="Reason" name="reason" options={REASONS.map((r) => ({ value: r, label: r }))} error={fields.reason} />
      <Textarea label="Details (optional)" name="details" maxLength={500} error={fields.details} />
      <div className="flex gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={pending}>Submit report</button>
      </div>
    </form>
  );
}
