import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AccountError } from "@hkfinhub/accounts";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod-pipe";
import { beneficiarySchema, openCurrencySchema, type BeneficiaryBody } from "./schemas";
import { formatMinor } from "./format";
import { mapDomainError } from "../common/domain-errors";

const uuid = z.uuid();

/** Domain errors become HTTP errors with stable codes. Anything unexpected is rethrown. */
function mapAccountError(err: unknown): never {
  if (err instanceof AccountError) {
    const status = err.code === "NOT_FOUND" ? HttpStatus.NOT_FOUND : HttpStatus.UNPROCESSABLE_ENTITY;
    throw new HttpException({ code: err.code, message: err.message }, status);
  }
  throw err;
}

@Controller("accounts")
export class AccountsController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  /** Customer account, with each currency's available, pending and total balance. */
  @Get()
  @UseGuards(AuthGuard)
  async summary(@Req() req: AuthedRequest) {
    const s = await this.c.accounts.summary(req.auth.userId);
    return {
      accountRef: s.accountRef,
      currencies: s.currencies.map((c) => ({
        currency: c.currency,
        opened: c.opened,
        available: { amountMinor: c.availableMinor, display: formatMinor(BigInt(c.availableMinor), c.currency) },
        pending: { amountMinor: c.pendingMinor, display: formatMinor(BigInt(c.pendingMinor), c.currency) },
        total: { amountMinor: c.totalMinor, display: formatMinor(BigInt(c.totalMinor), c.currency) },
      })),
    };
  }

  /** The receiving account for transfers into HK FinHub. Login required; never public. */
  @Get("receiving-account")
  @UseGuards(AuthGuard)
  receivingAccount() {
    const acct = this.c.config.receivingAccount;
    if (!acct) return { configured: false };
    return { configured: true, ...acct };
  }

  @Post("currencies")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async openCurrency(@Body(new ZodPipe(openCurrencySchema)) body: { currency: string }, @Req() req: AuthedRequest) {
    try {
      return await this.c.accounts.openCurrencyAccount(req.auth.userId, body.currency);
    } catch (err) {
      return mapAccountError(err);
    }
  }
}

@Controller()
export class DashboardController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  /**
   * Everything the home screen needs. Cash and investment value are separate, and investment value is
   * zero until the brokerage partner is connected (phase 8). Cash total is HKD only: no FX conversion yet.
   */
  @Get("dashboard")
  @UseGuards(AuthGuard)
  async dashboard(@Req() req: AuthedRequest) {
    const account = await this.c.accounts.summary(req.auth.userId);
    const rows = await this.c.accounts.ledgerRows(req.auth.userId);
    const hkdRow = (await this.c.wallet.balances(rows.filter((r) => r.currency === "HKD")))[0];
    const totals = await this.c.wallet.totals(rows.flatMap((r) => [r.availableLedgerId, r.holdLedgerId]), "HKD");
    const activity = await this.c.wallet.activity(rows.map((r) => r.availableLedgerId), 10);
    const kyc = await this.c.kyc.status(req.auth.userId);
    const cashMinor = hkdRow ? hkdRow.availableMinor + hkdRow.pendingMinor : 0n;
    return {
      baseCurrency: "HKD",
      cashTotal: { amountMinor: cashMinor.toString(), display: formatMinor(cashMinor, "HKD") },
      accounts: account.currencies.filter((c) => c.opened),
      kyc: { status: kyc.status, tier: kyc.tier, verifiedAt: kyc.verifiedAt, missing: kyc.missing },
      // Outgoing money waiting on a provider. Not yet debited; shown so the customer sees it.
      pendingOutgoing: { amountMinor: (await this.c.transfers.reservedFor(account.accountId, "HKD")).toString(), currency: "HKD" },
      investmentValue: { marketValueMinor: "0", unrealisedPnlMinor: "0", source: "Investments are not yet connected" },
      totals: {
        deposits: { amountMinor: totals.depositsMinor.toString(), display: formatMinor(totals.depositsMinor, "HKD") },
        withdrawals: { amountMinor: totals.withdrawalsMinor.toString(), display: formatMinor(totals.withdrawalsMinor, "HKD") },
        transfers: { amountMinor: totals.transfersMinor.toString(), display: formatMinor(totals.transfersMinor, "HKD") },
      },
      recentActivity: activity,
    };
  }

  @Get("transactions")
  @UseGuards(AuthGuard)
  async transactions(@Query("limit") limit: string | undefined, @Req() req: AuthedRequest) {
    const n = Math.min(Math.max(Number(limit ?? 20) || 20, 1), 100);
    const rows = await this.c.accounts.ledgerRows(req.auth.userId);
    return { items: await this.c.wallet.activity(rows.map((r) => r.availableLedgerId), n) };
  }

  @Get("beneficiaries")
  @UseGuards(AuthGuard)
  async beneficiaries(@Req() req: AuthedRequest) {
    return { items: await this.c.accounts.listBeneficiaries(req.auth.userId) };
  }

  @Post("beneficiaries")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async addBeneficiary(@Body(new ZodPipe(beneficiarySchema)) body: BeneficiaryBody, @Req() req: AuthedRequest) {
    const created = await this.c.accounts.addBeneficiary(req.auth.userId, body).catch((err: unknown) => mapAccountError(err));
    try {
      // Screened on creation. A hit opens a blocking case, so payouts to this recipient are held.
      await this.c.compliance.screenSubject({ subjectType: "BENEFICIARY", subjectId: created.id, accountId: null, name: body.name, dateOfBirth: null, country: body.country });
    } catch (err) {
      // Fail closed: if screening is unavailable, the recipient is removed again rather than left unscreened.
      await this.c.accounts.removeBeneficiary(req.auth.userId, created.id);
      return mapDomainError(err);
    }
    return created;
  }

  @Delete("beneficiaries/:id")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async removeBeneficiary(@Param("id") id: string, @Req() req: AuthedRequest) {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) throw new BadRequestException({ code: "VALIDATION_FAILED", message: "invalid id" });
    try {
      await this.c.accounts.removeBeneficiary(req.auth.userId, parsed.data);
      return { ok: true };
    } catch (err) {
      return mapAccountError(err);
    }
  }
}
