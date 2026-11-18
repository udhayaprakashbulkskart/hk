import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { CartQty } from "@/components/forms/cart-line";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await pageUser("/cart");
  const items = await db.cartItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { product: { include: { media: { where: { type: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } }, seller: { select: { seller: { select: { storeName: true } } } } } } },
  });
  if (!items.length) return <><PageTitle title="Your Cart" /><EmptyState title="Your cart is empty" body="Find something you love in the marketplace." action={{ href: "/skins", label: "Browse skins" }} /></>;
  const unavailable = items.filter((i) => i.product.status !== "APPROVED" || i.product.stock < i.quantity);
  const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  return (
    <div>
      <PageTitle title="Your Cart" subtitle={`${items.length} item${items.length > 1 ? "s" : ""}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {items.map(({ product: p, quantity }) => {
            const bad = p.status !== "APPROVED" || p.stock < quantity;
            return (
              <li key={p.id} className={`card flex items-center gap-3 p-3 ${bad ? "border-neon/50" : ""}`}>
                <Link href={`/product/${p.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-black">
                  {p.media[0] && <Image src={p.media[0].url} alt="" fill sizes="80px" className="object-cover" unoptimized={p.media[0].url.endsWith(".svg") || p.media[0].url.startsWith("/uploads/")} />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${p.slug}`} className="line-clamp-1 font-semibold hover:text-neon">{p.title}</Link>
                  <p className="text-xs text-muted">{p.isOfficialStore ? "Official store" : p.seller.seller?.storeName}</p>
                  {bad && <p className="text-xs text-neon-soft">{p.status !== "APPROVED" ? "No longer available — remove it to continue" : `Only ${p.stock} left`}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <CartQty productId={p.id} quantity={quantity} stock={p.stock} />
                    <span className="font-display text-lg font-bold">{formatINR(p.price * quantity)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-20">
          <h2 className="heading text-lg">Summary</h2>
          <div className="flex justify-between text-sm text-muted"><span>Subtotal</span><span>{formatINR(total)}</span></div>
          <div className="flex justify-between text-sm text-muted"><span>Fees</span><span>₹0</span></div>
          <div className="flex justify-between border-t border-line pt-3 font-display text-xl font-bold"><span>Total</span><span>{formatINR(total)}</span></div>
          {unavailable.length > 0 ? (
            <button className="btn-primary w-full" disabled>Fix cart issues to continue</button>
          ) : (
            <Link href="/checkout" className="btn-primary w-full py-3">Proceed to checkout</Link>
          )}
        </aside>
      </div>
    </div>
  );
}
