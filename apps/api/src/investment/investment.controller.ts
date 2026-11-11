import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { mapDomainError } from "../common/domain-errors";
import { ZodPipe } from "../common/zod-pipe";
import { formatMinor } from "../accounts/format";

const digits = z.string().regex(/^\d{1,15}$/, "must be a whole number");
const orderSchema = z
  .object({
    symbol: z.string().trim().min(1).max(12),
    side: z.enum(["BUY", "SELL"]),
    quantity: digits,
    limitPriceMinor: digits.nullable().optional(),
    currency: z.string().trim().length(3),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

/** Investments are shown with cost basis only. There is no licensed price feed, so no market value is shown. */
const VALUATION_NOTE = "Market value is not available: no licensed price feed is connected. Figures are cost basis from broker-confirmed trades.";

@Controller("investments")
export class InvestmentController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post("orders")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async place(@Body(new ZodPipe(orderSchema)) body: z.infer<typeof orderSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.summary(req.auth.userId);
      const order = await this.c.investment.placeOrder({
        userId: req.auth.userId,
        accountId: account.accountId,
        symbol: body.symbol.toUpperCase(),
        side: body.side,
        quantity: BigInt(body.quantity),
        limitPriceMinor: body.limitPriceMinor ? BigInt(body.limitPriceMinor) : null,
        currency: body.currency,
        idempotencyKey: body.idempotencyKey,
      });
      return orderView(order);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get("orders")
  @UseGuards(AuthGuard)
  async list(@Req() req: AuthedRequest) {
    const rows = await this.c.investment.orders(req.auth.userId, 50);
    return { items: rows.map(orderView) };
  }

  /** Pulls the latest state from the broker and posts settlement once the order is fully filled. */
  @Post("orders/:orderId/sync")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async sync(@Param("orderId") orderId: string, @Req() req: AuthedRequest) {
    const mine = (await this.c.investment.orders(req.auth.userId, 500)).find((o) => o.id === orderId);
    if (!mine) throw new HttpException({ code: "NOT_FOUND", message: "order not found" }, 404);
    try {
      return orderView(await this.c.investment.sync(orderId));
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get("holdings")
  @UseGuards(AuthGuard)
  async holdings(@Req() req: AuthedRequest) {
    try {
      const rows = await this.c.investment.holdings(req.auth.userId);
      return {
        valuationNote: VALUATION_NOTE,
        items: rows.map((r) => ({
          symbol: r.symbol,
          quantity: r.position.quantity.toString(),
          averageCost: { amountMinor: r.position.averageCostMinor.toString(), display: formatMinor(r.position.averageCostMinor, "HKD") },
          costBasis: { amountMinor: r.position.costBasisMinor.toString(), display: formatMinor(r.position.costBasisMinor, "HKD") },
          realisedPnl: { amountMinor: r.position.realisedPnlMinor.toString(), display: formatMinor(r.position.realisedPnlMinor, "HKD") },
          marketValue: null,
        })),
      };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

function orderView(o: Awaited<ReturnType<Container["investment"]["orders"]>>[number]) {
  return {
    id: o.id,
    symbol: o.symbol,
    side: o.side,
    quantity: o.quantity.toString(),
    limitPrice: o.limitPriceMinor === null ? null : o.limitPriceMinor.toString(),
    filledQuantity: o.filledQuantity.toString(),
    status: o.status,
    currency: o.currency,
    settled: o.settledMinor === null ? null : { amountMinor: o.settledMinor.toString(), display: formatMinor(o.settledMinor, o.currency as "HKD") },
    createdAt: o.createdAt.toISOString(),
  };
}
