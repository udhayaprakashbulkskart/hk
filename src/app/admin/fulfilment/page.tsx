import type { Metadata } from "next";

import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { GAME_LABEL } from "@/lib/constants";
import { DeliverForm } from "@/components/forms/order-actions";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Fulfilment" };

/** Store fulfilment queue: every paid order item, with the buyer's Player ID, to deliver in-game. */
export default async function FulfilmentPage() {
  const items = await db.orderItem.findMany({
    where: { status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { select: { orderNumber: true, gamePlayerId: true, gameNickname: true, game: true, buyer: { select: { name: true } } } }, review: { select: { rating: true, comment: true } } },
  });
  const toDeliver = items.filter((i) => i.status === "PROCESSING");
  return (
    <div>
      <PageTitle title="Order fulfilment" subtitle={`${toDeliver.length} awaiting delivery`} />
      {items.length === 0 ? (
        <EmptyState title="No orders yet" body="Paid orders appear here with the buyer's Player ID to deliver to." />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className={`card space-y-3 p-4 ${it.status === "PROCESSING" ? "border-neon/50" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{it.titleSnapshot} {it.quantity > 1 && <span className="text-muted">× {it.quantity}</span>}</p>
                  <p className="text-xs text-muted">{it.order.orderNumber} · {it.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · buyer {it.order.buyer.name.split(" ")[0]}</p>
                </div>
                <StatusBadge status={it.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-panel-2 p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted">Deliver to Player ID</p><p className="font-mono font-semibold">{it.order.gamePlayerId}</p>{it.order.gameNickname && <p className="text-xs text-muted">Nickname: {it.order.gameNickname}</p>}</div>
                <div><p className="text-xs text-muted">Game</p><p>{GAME_LABEL[it.order.game]}</p></div>
                <div><p className="text-xs text-muted">Sale price</p><p>{formatINR(it.lineTotal)}</p></div>
                <div><p className="text-xs text-muted">Paid</p><p className="font-semibold text-success">{formatINR(it.lineTotal - it.discount)}</p></div>
              </div>
              {it.deliveryNote && <p className="text-sm text-zinc-400">Delivery note: {it.deliveryNote}</p>}
              {it.review && <p className="text-sm text-zinc-300">★ {it.review.rating}/5 {it.review.comment && `— “${it.review.comment}”`}</p>}
              {it.status === "PROCESSING" && <DeliverForm itemId={it.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
