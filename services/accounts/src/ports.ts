export interface AccountRecord {
  id: string;
  userId: string;
  accountRef: string;
  status: string;
  createdAt: Date;
}

export interface CurrencyAccountRecord {
  id: string;
  accountId: string;
  currency: string;
  availableLedgerId: string;
  holdLedgerId: string;
}

export interface BeneficiaryRecord {
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

/** Persistence for customer accounts and beneficiaries. Implemented by packages/database. */
export interface AccountsStore {
  findAccountIdByRef(accountRef: string): Promise<string | null>;
  findAccountByUser(userId: string): Promise<AccountRecord | null>;
  createAccount(userId: string, accountRef: string): Promise<AccountRecord>;
  listCurrencyAccounts(accountId: string): Promise<CurrencyAccountRecord[]>;
  findCurrencyAccount(accountId: string, currency: string): Promise<CurrencyAccountRecord | null>;
  createCurrencyAccount(input: Omit<CurrencyAccountRecord, "id">): Promise<CurrencyAccountRecord>;
  listBeneficiaries(accountId: string): Promise<BeneficiaryRecord[]>;
  findBeneficiary(id: string, accountId: string): Promise<BeneficiaryRecord | null>;
  createBeneficiary(input: Omit<BeneficiaryRecord, "id" | "createdAt">): Promise<BeneficiaryRecord>;
  softDeleteBeneficiary(id: string, accountId: string, now: Date): Promise<boolean>;
}
