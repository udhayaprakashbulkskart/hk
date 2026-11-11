/**
 * Position from broker-confirmed fills only. Average-cost basis, integer minor units. Integer division floors,
 * so the average cost is rounded down and the realised P&L is exact for the fills given.
 */
export interface Fill {
  id: string;
  side: "BUY" | "SELL";
  quantity: bigint;
  priceMinor: bigint;
  executedAt: Date;
}

export interface Position {
  quantity: bigint;
  averageCostMinor: bigint;
  costBasisMinor: bigint;
  realisedPnlMinor: bigint;
}

export function positionFromFills(fills: Fill[]): Position {
  const ordered = [...fills].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime() || a.id.localeCompare(b.id));
  let qty = 0n;
  let avg = 0n;
  let realised = 0n;
  for (const f of ordered) {
    if (f.quantity <= 0n || f.priceMinor < 0n) throw new Error("invalid fill");
    if (f.side === "BUY") {
      const newQty = qty + f.quantity;
      avg = (avg * qty + f.priceMinor * f.quantity) / newQty;
      qty = newQty;
    } else {
      if (f.quantity > qty) throw new Error("fill sells more than is held");
      realised += (f.priceMinor - avg) * f.quantity;
      qty -= f.quantity;
      if (qty === 0n) avg = 0n;
    }
  }
  return { quantity: qty, averageCostMinor: avg, costBasisMinor: avg * qty, realisedPnlMinor: realised };
}
