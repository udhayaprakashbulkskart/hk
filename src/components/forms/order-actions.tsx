"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import clsx from "clsx";
import { useToast } from "@/components/ui/toast";
import { FormError, Textarea } from "@/components/ui/field";
import { ActionButton } from "./action-button";
import { useApiForm } from "./use-api-form";

/** Buyer-side actions for a single order line. */
export function BuyerItemActions({ itemId, status, canReview }: { itemId: string; status: string; canReview: boolean }) {
  const [mode, setMode] = useState<null | "refund" | "review">(null);
  const [rating, setRating] = useState(5);
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "DELIVERED" && <ActionButton url={`/api/order-items/${itemId}/complete`} method="POST" variant="primary" label="Confirm received" confirm="Confirm you received this item in-game? The seller will be paid." success="Thanks! Order completed." />}
        {["PROCESSING", "DELIVERED"].includes(status) && <button className="btn-ghost btn-sm" onClick={() => setMode(mode === "refund" ? null : "refund")}>Request refund</button>}
        {canReview && <button className="btn-outline btn-sm" onClick={() => setMode(mode === "review" ? null : "review")}>Rate seller</button>}
      </div>
      {mode === "refund" && (
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          const reason = new FormData(e.currentTarget).get("reason");
          if (await submit("/api/refunds", { orderItemId: itemId, reason })) { toast("success", "Refund requested — we'll review it shortly"); setMode(null); router.refresh(); }
        }}>
          <FormError message={error} />
          <Textarea label="What went wrong?" name="reason" required error={fields.reason} placeholder="e.g. Gift not received after 24 hours" />
          <button className="btn-primary btn-sm" disabled={pending}>Submit refund request</button>
        </form>
      )}
      {mode === "review" && (
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          const comment = new FormData(e.currentTarget).get("comment");
          if (await submit("/api/reviews", { orderItemId: itemId, rating, comment: comment || undefined })) { toast("success", "Thanks for your review!"); setMode(null); router.refresh(); }
        }}>
          <FormError message={error} />
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
                <Star className={clsx("size-6", n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600")} />
              </button>
            ))}
          </div>
          <Textarea label="Comment (optional)" name="comment" maxLength={500} />
          <button className="btn-primary btn-sm" disabled={pending}>Submit review</button>
        </form>
      )}
    </div>
  );
}

/** Seller marks an item delivered with a note (gift time / redeem code). */
export function DeliverForm({ itemId }: { itemId: string }) {
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>Mark delivered</button>;
  return (
    <form className="w-full space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      if (await submit(`/api/order-items/${itemId}/deliver`, { deliveryNote: new FormData(e.currentTarget).get("deliveryNote") })) { toast("success", "Marked as delivered"); router.refresh(); }
    }}>
      <FormError message={error} />
      <Textarea label="Delivery note" name="deliveryNote" required error={fields.deliveryNote} placeholder="e.g. Sent via in-game gift at 18:40 IST, or the redeem code" />
      <div className="flex gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary btn-sm" disabled={pending}>Confirm delivery</button>
      </div>
    </form>
  );
}
