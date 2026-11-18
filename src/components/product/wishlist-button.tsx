"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function WishlistButton({ productId, initial, className }: { productId: string; initial: boolean; className?: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved items" : "Save item"}
      aria-pressed={saved}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved((s) => !s);
        start(async () => {
          const r = await api<{ saved: boolean }>("/api/wishlist", { body: { productId } });
          if (!r.ok) {
            setSaved(initial);
            if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
            return toast("error", r.error);
          }
          setSaved(r.data.saved);
          toast("success", r.data.saved ? "Saved to your wishlist" : "Removed from wishlist");
        });
      }}
      className={clsx("grid size-9 place-items-center rounded-full border border-white/10 bg-black/50 backdrop-blur transition hover:border-neon/60", className)}
    >
      <Heart className={clsx("size-4 transition", saved ? "fill-neon text-neon" : "text-white")} />
    </button>
  );
}
