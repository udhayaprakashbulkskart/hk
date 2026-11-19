"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/states";

export function AddToCartButton({ productId, compact, className, disabled, variant = "outline", quantity = 1 }: { productId: string; compact?: boolean; className?: string; disabled?: boolean; variant?: "outline" | "primary"; quantity?: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const add = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await api("/api/cart", { body: { productId, quantity } });
      if (!r.ok) {
        if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        return toast("error", r.error);
      }
      toast("success", quantity > 1 ? `Added ${quantity} to cart` : "Added to cart");
      router.refresh();
    });
  };
  if (compact) {
    return (
      <button type="button" onClick={add} disabled={pending || disabled} aria-label="Add to cart" className={clsx("grid size-9 place-items-center rounded-lg bg-mint text-black shadow-mint transition hover:brightness-110 disabled:opacity-50", className)}>
        {pending ? <Spinner /> : <ShoppingCart className="size-4" />}
      </button>
    );
  }
  return (
    <button type="button" onClick={add} disabled={pending || disabled} className={clsx(variant === "primary" ? "btn-primary" : "btn-outline", "py-3", className)}>
      {pending ? <Spinner className="size-4 border-black/30 border-t-black" /> : <ShoppingCart className="size-4" />} {disabled ? "Sold out" : "Add to Cart"}
    </button>
  );
}

export function BuyNowButton({ productId, disabled, className, quantity = 1 }: { productId: string; disabled?: boolean; className?: string; quantity?: number }) {
  const router = useRouter();
  return (
    <button type="button" disabled={disabled} onClick={() => router.push(`/checkout?product=${productId}&quantity=${quantity}`)} className={clsx("btn-primary py-3", className)}>
      <Zap className="size-4" /> Buy Now
    </button>
  );
}

/** Quantity stepper + Add to Cart / Buy Now (product details page). */
export function PurchasePanel({ productId, stock, disabled }: { productId: string; stock: number; disabled?: boolean }) {
  const max = Math.max(1, Math.min(10, stock));
  const [qty, setQty] = useState(1);
  return (
    <div className="space-y-3">
      {max > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Quantity</span>
          <div className="flex items-center rounded-lg border border-neon/40 bg-[#17191c]">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="p-2.5 text-neon disabled:opacity-40"><Minus className="size-4" /></button>
            <span className="w-10 text-center font-bold tabular-nums" aria-live="polite">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Increase quantity" className="p-2.5 text-neon disabled:opacity-40"><Plus className="size-4" /></button>
          </div>
          <span className="text-xs text-muted">max {max}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <AddToCartButton productId={productId} disabled={disabled} quantity={qty} />
        <BuyNowButton productId={productId} disabled={disabled} quantity={qty} />
      </div>
    </div>
  );
}
