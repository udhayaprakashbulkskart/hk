import { randomBytes } from "node:crypto";
import { decryptField, encryptField } from "@hkfinhub/authentication";
import { LAUNCH_CURRENCIES, isLaunchCurrency, type LaunchCurrency } from "@hkfinhub/shared";
import type { LedgerService } from "@hkfinhub/ledger";
import { AccountError } from "./errors";
import type { AccountRecord, AccountsStore, BeneficiaryRecord } from "./ports";

export interface AccountsConfig {
  /** AES-256-GCM key for beneficiary destinations (UPI IDs, account numbers). */
  fieldKey: Uint8Array;
}

export interface BeneficiaryInput {
  name: string;
  country: string;
  method: "upi" | "bank" | "swift";
  destination: string;
  currency: LaunchCurrency;
}

export interface PublicBeneficiary {
  id: string;
  name: string;
  country: string;
  method: string;
  currency: string;
  destination: string;
  createdAt: string;
}

/**
 * Customer accounts: one account per customer, one currency account per currency, and saved recipients.
 * Money is never moved here. Currency accounts map onto ledger accounts (AVAILABLE and HOLD).
 */
export class AccountsService {
  constructor(private readonly store: AccountsStore, private readonly ledger: LedgerService, private readonly config: AccountsConfig) {}

  /** Returns the customer's account, creating it and its HKD currency account on first use. */
  async ensureAccount(userId: string): Promise<AccountRecord> {
    const account = (await this.store.findAccountByUser(userId)) ?? (await this.createAccountOnce(userId));
    await this.openCurrency(account, "HKD");
    return account;
  }

  async openCurrencyAccount(userId: string, currency: string): Promise<{ currency: string; opened: boolean }> {
    if (!isLaunchCurrency(currency)) throw new AccountError("INVALID_REQUEST", `${currency} is not offered yet`);
    const account = await this.ensureAccount(userId);
    const opened = await this.openCurrency(account, currency);
    return { currency, opened };
  }

  /** Customer's currencies with balances, from the ledger. Currencies not yet opened are reported as such. */
  async summary(userId: string) {
    const account = await this.ensureAccount(userId);
    const currencies = await this.store.listCurrencyAccounts(account.id);
    const ids = currencies.flatMap((c) => [c.availableLedgerId, c.holdLedgerId]);
    const balances = await this.ledger.getBalances(ids);
    const rows = LAUNCH_CURRENCIES.map((code) => {
      const c = currencies.find((x) => x.currency === code);
      const available = c ? (balances.get(c.availableLedgerId) ?? 0n) : 0n;
      const pending = c ? (balances.get(c.holdLedgerId) ?? 0n) : 0n;
      return { currency: code, opened: !!c, availableMinor: available.toString(), pendingMinor: pending.toString(), totalMinor: (available + pending).toString() };
    });
    return { accountRef: account.accountRef, accountId: account.id, currencies: rows };
  }

  /** Ledger account ids for each open currency. Used by the wallet to read balances and activity. */
  async ledgerRows(userId: string): Promise<{ currency: string; availableLedgerId: string; holdLedgerId: string }[]> {
    const account = await this.ensureAccount(userId);
    return (await this.store.listCurrencyAccounts(account.id)).map((c) => ({ currency: c.currency, availableLedgerId: c.availableLedgerId, holdLedgerId: c.holdLedgerId }));
  }

  async listBeneficiaries(userId: string): Promise<PublicBeneficiary[]> {
    const account = await this.ensureAccount(userId);
    return (await this.store.listBeneficiaries(account.id)).map((b) => this.toPublic(b));
  }

  async addBeneficiary(userId: string, input: BeneficiaryInput): Promise<PublicBeneficiary> {
    const account = await this.ensureAccount(userId);
    const name = input.name.trim();
    const destination = input.destination.trim();
    if (name.length < 2 || name.length > 120) throw new AccountError("INVALID_REQUEST", "recipient name must be 2 to 120 characters");
    if (destination.length < 4 || destination.length > 64) throw new AccountError("INVALID_REQUEST", "destination must be 4 to 64 characters");
    if (!/^[A-Z]{2}$/.test(input.country)) throw new AccountError("INVALID_REQUEST", "country must be a two-letter ISO code");
    if (!isLaunchCurrency(input.currency)) throw new AccountError("INVALID_REQUEST", `${input.currency} is not offered yet`);
    const saved = await this.store.createBeneficiary({
      accountId: account.id,
      name,
      country: input.country,
      method: input.method,
      currency: input.currency,
      destinationEnc: encryptField(this.config.fieldKey, destination),
      destinationMasked: maskDestination(destination),
    });
    return this.toPublic(saved);
  }

  async removeBeneficiary(userId: string, id: string, now = new Date()): Promise<void> {
    const account = await this.ensureAccount(userId);
    const ok = await this.store.softDeleteBeneficiary(id, account.id, now);
    if (!ok) throw new AccountError("NOT_FOUND", "recipient not found");
  }

  /** Resolves a customer's account reference to its account id. Returns null for unknown references. */
  async resolveAccountRef(accountRef: string): Promise<string | null> {
    return this.store.findAccountIdByRef(accountRef);
  }

  /** Everything a payout needs for one saved recipient. Decrypted; for the payment path only. */
  async payoutDetails(userId: string, id: string): Promise<{ name: string; country: string; method: "upi" | "bank" | "swift"; currency: LaunchCurrency; destination: string }> {
    const account = await this.ensureAccount(userId);
    const b = await this.store.findBeneficiary(id, account.id);
    if (!b) throw new AccountError("NOT_FOUND", "recipient not found");
    return { name: b.name, country: b.country, method: b.method as "upi" | "bank" | "swift", currency: b.currency as LaunchCurrency, destination: decryptField(this.config.fieldKey, b.destinationEnc) };
  }

  /** Full destination, decrypted. Only for the payment path, never for display lists. */
  async revealDestination(userId: string, id: string): Promise<string> {
    const account = await this.ensureAccount(userId);
    const b = await this.store.findBeneficiary(id, account.id);
    if (!b) throw new AccountError("NOT_FOUND", "recipient not found");
    return decryptField(this.config.fieldKey, b.destinationEnc);
  }

  // -------------------------------------------------------------------- internals

  /** Two first requests can race. The loser of the unique-user race reads the winner's account. */
  private async createAccountOnce(userId: string): Promise<AccountRecord> {
    try {
      return await this.store.createAccount(userId, newAccountRef());
    } catch {
      const won = await this.store.findAccountByUser(userId);
      if (!won) throw new AccountError("NOT_FOUND", "account could not be created");
      return won;
    }
  }

  private async openCurrency(account: AccountRecord, currency: LaunchCurrency): Promise<boolean> {
    const existing = await this.store.findCurrencyAccount(account.id, currency);
    if (existing) return false;
    const [available, hold] = await Promise.all([
      this.ledger.customerAccount(account.id, currency, "AVAILABLE"),
      this.ledger.customerAccount(account.id, currency, "HOLD"),
    ]);
    try {
      await this.store.createCurrencyAccount({ accountId: account.id, currency, availableLedgerId: available.id, holdLedgerId: hold.id });
      return true;
    } catch {
      // Lost a race with a concurrent open of the same currency. The row exists, so the outcome is the same.
      return false;
    }
  }

  private toPublic(b: BeneficiaryRecord): PublicBeneficiary {
    return { id: b.id, name: b.name, country: b.country, method: b.method, currency: b.currency, destination: b.destinationMasked, createdAt: b.createdAt.toISOString() };
  }
}

export function newAccountRef(): string {
  const digits = Array.from(randomBytes(8), (b) => (b % 10).toString()).join("");
  return `HKA${digits}`;
}

/** Shows only the last four characters, so a saved recipient is recognisable without being exposed. */
export function maskDestination(value: string): string {
  const tail = value.slice(-4);
  return `${"•".repeat(Math.max(4, Math.min(value.length - 4, 12)))}${tail}`;
}

export type { CurrencyAccountRecord } from "./ports";
export type { AccountsStore } from "./ports";
export type { AccountRecord, BeneficiaryRecord } from "./ports";
export type { LaunchCurrency };
