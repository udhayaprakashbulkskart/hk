import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards, BadRequestException, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod-pipe";
import { mapDomainError } from "../common/domain-errors";
import { depositSchema, fxConvertSchema, fxQuoteSchema, internalTransferSchema, payoutSchema, providerParam, requestCreateSchema, requestPaySchema, withdrawalSchema } from "./schemas";
import { formatMinor } from "../accounts/format";
import { LAUNCH } from "./launch";
import { z } from "zod";

/** Deposits (collections) into the customer's own account. The response carries only what the app needs to finish the payment. */
@Controller("deposits")
export class DepositsController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post()
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async create(@Body(new ZodPipe(depositSchema)) body: z.infer<typeof depositSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const amount = BigInt(body.amountMinor);
      const r = await this.c.payments.createCollection({
        accountId: account.id,
        currency: body.currency,
        amountMinor: amount,
        method: body.method,
        country: body.country,
        idempotencyKey: `deposit-${req.auth.userId}-${body.idempotencyKey}`,
        description: "Deposit to HK FinHub account",
      });
      return {
        paymentId: r.payment.id,
        status: r.payment.status,
        amount: { amountMinor: body.amountMinor, display: formatMinor(amount, body.currency) },
        clientSecret: r.clientSecret,
        checkoutUrl: r.checkoutUrl,
        instructions: r.instructions,
        replayed: r.replayed,
      };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

@Controller("transfers")
export class TransfersController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post("internal")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async internal(@Body(new ZodPipe(internalTransferSchema)) body: z.infer<typeof internalTransferSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const t = await this.c.transfers.internal({ accountId: account.id, toAccountRef: body.toAccountRef, currency: body.currency, amountMinor: BigInt(body.amountMinor), idempotencyKey: `${req.auth.userId}:${body.idempotencyKey}` });
      return present(t);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async payout(@Body(new ZodPipe(payoutSchema)) body: z.infer<typeof payoutSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const t = await this.c.transfers.payout({
        accountId: account.id,
        userId: req.auth.userId,
        beneficiaryId: body.beneficiaryId,
        sourceCurrency: body.sourceCurrency,
        amountMinor: BigInt(body.amountMinor),
        fxQuoteId: body.fxQuoteId ?? null,
        idempotencyKey: `${req.auth.userId}:${body.idempotencyKey}`,
      });
      return present(t);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Post("withdrawals")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async withdraw(@Body(new ZodPipe(withdrawalSchema)) body: z.infer<typeof withdrawalSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const t = await this.c.transfers.payout({
        accountId: account.id,
        userId: req.auth.userId,
        beneficiaryId: body.beneficiaryId,
        sourceCurrency: body.sourceCurrency,
        amountMinor: BigInt(body.amountMinor),
        fxQuoteId: null,
        kind: "WITHDRAWAL",
        idempotencyKey: `${req.auth.userId}:wd:${body.idempotencyKey}`,
      });
      return present(t);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  async list(@Req() req: AuthedRequest, @Query("limit") limit?: string) {
    const account = await this.c.accounts.ensureAccount(req.auth.userId);
    const n = Math.min(Math.max(Number(limit ?? 20) || 20, 1), 100);
    return { items: (await this.c.transfers.list(account.id, n)).map(present) };
  }

  @Get(":id")
  @UseGuards(AuthGuard)
  async get(@Param("id") id: string, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      return present(await this.c.transfers.get(account.id, id));
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

@Controller("fx")
export class FxController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post("quotes")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async quote(@Body(new ZodPipe(fxQuoteSchema)) body: z.infer<typeof fxQuoteSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const q = await this.c.fx.quote({ accountId: account.id, from: body.from, to: body.to, amountMinor: BigInt(body.amountMinor) });
      return presentQuote(q);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Post("conversions")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async convert(@Body(new ZodPipe(fxConvertSchema)) body: z.infer<typeof fxConvertSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const reserved = (accountId: string, currency: string) => this.c.transfers.reservedFor(accountId, currency);
      const out = await this.c.fx.convert({ accountId: account.id, quoteId: body.quoteId, reservedMinor: reserved });
      return { conversion: presentQuote(out.quote), ledgerTransactionId: out.ledgerTransactionId };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get("history")
  @UseGuards(AuthGuard)
  async history(@Query("from") from: string, @Query("to") to: string, @Query("days") days?: string) {
    try {
      const rows = await this.c.fx.history(from, to, Number(days ?? 30) || 30);
      return { pair: `${from}/${to}`, sample: true, points: rows.map((r) => ({ date: r.date, rateScaled: r.rateScaled.toString() })) };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

@Controller("payment-requests")
export class RequestsController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post()
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async create(@Body(new ZodPipe(requestCreateSchema)) body: z.infer<typeof requestCreateSchema>, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      const r = await this.c.transfers.createRequest({ accountId: account.id, currency: body.currency, amountMinor: body.amountMinor ? BigInt(body.amountMinor) : null, memo: body.memo });
      return presentRequest(r);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  async list(@Req() req: AuthedRequest) {
    const account = await this.c.accounts.ensureAccount(req.auth.userId);
    return { items: (await this.c.transfers.listRequests(account.id)).map(presentRequest) };
  }

  /** What a payer can see: the amount, memo and status. No account identifiers. */
  @Get(":ref/public")
  async publicView(@Param("ref") ref: string) {
    try {
      return await this.c.transfers.publicRequest(ref);
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Post(":ref/pay")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async pay(@Param("ref") ref: string, @Body(new ZodPipe(requestPaySchema)) body: z.infer<typeof requestPaySchema>) {
    try {
      const r = await this.c.transfers.payRequest({
        ref,
        method: body.method,
        country: body.country,
        ...(body.amountMinor ? { amountMinor: BigInt(body.amountMinor) } : {}),
        idempotencyKey: `pay-${ref}-${body.idempotencyKey}`,
      });
      return { paymentId: r.payment.id, status: r.payment.status, clientSecret: r.clientSecret, checkoutUrl: r.checkoutUrl, instructions: r.instructions };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Post(":ref/cancel")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async cancel(@Param("ref") ref: string, @Req() req: AuthedRequest) {
    try {
      const account = await this.c.accounts.ensureAccount(req.auth.userId);
      await this.c.transfers.cancelRequest(account.id, ref);
      return { ok: true };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

/** Provider webhooks. The body is the exact bytes the provider signed; no parsing happens before verification. */
@Controller("webhooks")
export class WebhooksController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post(":provider")
  @HttpCode(200)
  async receive(@Param("provider") provider: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parsed = providerParam.safeParse(provider);
    if (!parsed.success) throw new BadRequestException({ code: "UNKNOWN_PROVIDER", message: "unknown provider" });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    try {
      const result = await this.c.payments.processWebhook(parsed.data, raw, headers);
      if (parsed.data === "adyen") {
        res.type("text/plain");
        return "[accepted]";
      }
      return { received: true, outcomes: result.outcomes };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

/** Launch currency list, exposed so clients never hard-code it. */
@Controller("config")
export class ConfigController {
  @Get("currencies")
  currencies() {
    return { currencies: LAUNCH };
  }
}

function present(t: {
  id: string; kind: string; status: string; sourceCurrency: string; sourceMinor: bigint; feeMinor: bigint;
  recipientCurrency: string; recipientMinor: bigint; destinationMasked: string | null; failureReason: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    debit: { amountMinor: t.sourceMinor.toString(), currency: t.sourceCurrency, display: formatMinor(t.sourceMinor, t.sourceCurrency as never) },
    recipient: { amountMinor: t.recipientMinor.toString(), currency: t.recipientCurrency, display: formatMinor(t.recipientMinor, t.recipientCurrency as never) },
    feeMinor: t.feeMinor.toString(),
    destination: t.destinationMasked,
    failureReason: t.failureReason,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function presentQuote(q: { id: string; fromCurrency: string; toCurrency: string; amountMinor: bigint; feeMinor: bigint; recipientMinor: bigint; rateScaled: bigint; provider: string; quotedAt: Date; expiresAt: Date }) {
  return {
    id: q.id,
    from: q.fromCurrency,
    to: q.toCurrency,
    amountMinor: q.amountMinor.toString(),
    feeMinor: q.feeMinor.toString(),
    recipientMinor: q.recipientMinor.toString(),
    rateScaled: q.rateScaled.toString(),
    rateScale: "100000000",
    provider: q.provider,
    quotedAt: q.quotedAt.toISOString(),
    expiresAt: q.expiresAt.toISOString(),
    sample: q.provider.startsWith("sandbox"),
  };
}

function presentRequest(r: { ref: string; currency: string; amountMinor: bigint | null; memo: string; status: string; createdAt: Date; paidAt: Date | null }) {
  return {
    reference: r.ref,
    currency: r.currency,
    amountMinor: r.amountMinor?.toString() ?? null,
    memo: r.memo,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
  };
}
