"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function CartQty({ productId, quantity, stock }: { productId: string; quantity: number; stock: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = (q: number) =>
    start(async () => {
      const r = q < 1 ? await api(`/api/cart?productId=${productId}`, { method: "DELETE" }) : await api("/api/cart", { body: { productId, quantity: q } });
      if (!r.ok) toast("error", r.error);
      router.refresh();
    });
  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <div className="flex items-center rounded-lg border border-line">
        <button className="p-2 disabled:opacity-40" aria-label="Decrease quantity" disabled={pending || quantity <= 1} onClick={() => set(quantity - 1)}><Minus className="size-3.5" /></button>
        <span className="w-6 text-center text-sm">{quantity}</span>
        <button className="p-2 disabled:opacity-40" aria-label="Increase quantity" disabled={pending || quantity >= Math.min(stock, 10)} onClick={() => set(quantity + 1)}><Plus className="size-3.5" /></button>
      </div>
      <button className="btn-ghost p-2" aria-label="Remove from cart" disabled={pending} onClick={() => set(0)}><Trash2 className="size-4" /></button>
    </div>
  );
}
