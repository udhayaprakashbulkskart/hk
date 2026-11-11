import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export interface AccountRow {
  id: string;
  userId: string;
  accountRef: string;
  status: string;
  createdAt: Date;
}

export interface CurrencyAccountRow {
  id: string;
  accountId: string;
  currency: string;
  availableLedgerId: string;
  holdLedgerId: string;
}

export interface BeneficiaryRow {
  id: string;
  accountId: string;
  name: string;
  country: string;
  method: string;
  currency: string;
  destinationEnc: string;
  destinationMasked: string;
  createdAt: Date;
}

/** Prisma store for customer accounts, currency accounts and beneficiaries. */
export class PrismaAccountsStore {
  constructor(private readonly db: Database | Tx) {}

  private get q(): Tx {
    return this.db as Tx;
  }

  async findAccountByUser(userId: string): Promise<AccountRow | null> {
    return this.q.account.findUnique({ where: { userId } });
  }

  async createAccount(userId: string, accountRef: string): Promise<AccountRow> {
    return this.q.account.create({ data: { userId, accountRef } });
  }

  async listCurrencyAccounts(accountId: string): Promise<CurrencyAccountRow[]> {
    return this.q.currencyAccount.findMany({ where: { accountId }, orderBy: { currency: "asc" } });
  }

  async findCurrencyAccount(accountId: string, currency: string): Promise<CurrencyAccountRow | null> {
    return this.q.currencyAccount.findUnique({ where: { accountId_currency: { accountId, currency } } });
  }

  async createCurrencyAccount(input: { accountId: string; currency: string; availableLedgerId: string; holdLedgerId: string }): Promise<CurrencyAccountRow> {
    return this.q.currencyAccount.create({ data: input });
  }

  async listBeneficiaries(accountId: string): Promise<BeneficiaryRow[]> {
    return this.q.beneficiary.findMany({ where: { accountId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  }

  async findBeneficiary(id: string, accountId: string): Promise<BeneficiaryRow | null> {
    return this.q.beneficiary.findFirst({ where: { id, accountId, deletedAt: null } });
  }

  async createBeneficiary(input: Omit<BeneficiaryRow, "id" | "createdAt">): Promise<BeneficiaryRow> {
    return this.q.beneficiary.create({ data: input });
  }

  async softDeleteBeneficiary(id: string, accountId: string, now: Date): Promise<boolean> {
    const r = await this.q.beneficiary.updateMany({ where: { id, accountId, deletedAt: null }, data: { deletedAt: now } });
    return r.count === 1;
  }

  /** Runs several store calls in one database transaction. */
  async transaction<T>(fn: (s: PrismaAccountsStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaAccountsStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted" });
  }
}

export { Prisma };
