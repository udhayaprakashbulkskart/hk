import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { razorpayConfigured } from "@/lib/razorpay";
import { CheckoutForm } from "@/components/forms/checkout-form";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const sp = await props.searchParams;
  const productId = typeof sp.product === "string" ? sp.product : undefined;
  const qty = Math.min(10, Math.max(1, Number(sp.quantity) || 1));
  const game = sp.game === "PUBG_MOBILE" || sp.game === "BGMI" ? sp.game : undefined;
  const pid = typeof sp.pid === "string" && /^\d{6,15}$/.test(sp.pid) ? sp.pid : undefined;
  const nick = typeof sp.nick === "string" ? sp.nick.slice(0, 40) : "";
  const back = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  const user = await pageUser(`/checkout${back.size ? `?${back}` : ""}`);
  const include = { media: { where: { type: "IMAGE" as const }, take: 1, orderBy: { sortOrder: "asc" as const } } };

  const lines = productId
    ? await db.product.findMany({ where: { id: productId, status: "APPROVED" }, include }).then((ps) => ps.map((p) => ({ p, quantity: Math.min(qty, Math.max(1, p.stock)) })))
    : await db.cartItem.findMany({ where: { userId: user.id }, include: { product: { include } } }).then((cs) => cs.map((c) => ({ p: c.product, quantity: c.quantity })));
  if (!productId && !lines.length) redirect("/cart");
  if (!lines.length) return <EmptyState title="Item unavailable" body="This item is no longer for sale." action={{ href: "/marketplace", label: "Back to marketplace" }} />;

  const subtotal = lines.reduce((s, l) => s + l.p.price * l.quantity, 0);
  const needsNickname = lines.some((l) => l.p.isOfficialStore);
  return (
    <div>
      <PageTitle title="Checkout" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-5 sm:p-6">
          <CheckoutForm
            subtotal={subtotal}
            quantity={productId ? lines[0].quantity : undefined}
            needsNickname={needsNickname}
            defaultNickname={nick}
            walletBalance={user.walletBalance}
            razorpayEnabled={razorpayConfigured()}
            defaultPlayerId={pid ?? user.gamePlayerId ?? ""}
            defaultGame={game ?? (user.preferredGame === "PUBG_MOBILE" ? "PUBG_MOBILE" : "BGMI")}
            productId={productId}
            user={{ name: user.name, email: user.email, phone: user.phone }}
          />
        </div>
        <aside className="card h-fit space-y-3 p-5">
          <h2 className="heading text-lg">Order summary</h2>
          {lines.map(({ p, quantity }) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-black">
                {p.media[0] && <Image src={p.media[0].url} alt="" fill sizes="48px" className="object-cover" unoptimized={p.media[0].url.endsWith(".svg") || p.media[0].url.startsWith("/uploads/")} />}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm">{p.title}{quantity > 1 && <span className="text-muted"> × {quantity}</span>}</p>
              <span className="text-sm font-semibold">{formatINR(p.price * quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-3 font-display text-lg font-bold"><span>Subtotal</span><span className="text-neon">{formatINR(subtotal)}</span></div>
          <p className="text-xs text-muted">Coupons are applied in the payment step.</p>
        </aside>
      </div>
    </div>
  );
}
