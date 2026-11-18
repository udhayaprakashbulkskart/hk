"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/states";

export function AddToCartButton({ productId, compact, className, disabled }: { productId: string; compact?: boolean; className?: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const add = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await api("/api/cart", { body: { productId, quantity: 1 } });
      if (!r.ok) {
        if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        return toast("error", r.error);
      }
      toast("success", "Added to cart");
      router.refresh();
    });
  };
  if (compact) {
    return (
      <button type="button" onClick={add} disabled={pending || disabled} aria-label="Add to cart" className={clsx("grid size-9 place-items-center rounded-lg bg-neon text-white shadow-neon transition hover:brightness-110 disabled:opacity-50", className)}>
        {pending ? <Spinner /> : <ShoppingCart className="size-4" />}
      </button>
    );
  }
  return (
    <button type="button" onClick={add} disabled={pending || disabled} className={clsx("btn-outline py-3", className)}>
      {pending ? <Spinner /> : <ShoppingCart className="size-4" />} Add to Cart
    </button>
  );
}

export function BuyNowButton({ productId, disabled, className }: { productId: string; disabled?: boolean; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" disabled={disabled} onClick={() => router.push(`/checkout?product=${productId}`)} className={clsx("btn-primary py-3", className)}>
      <Zap className="size-4 fill-white" /> Buy Now
    </button>
  );
}
