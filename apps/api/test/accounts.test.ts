import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

/** Registers, verifies and logs in a customer through the real endpoints. Returns the access token. */
async function customer(name: string): Promise<{ access: string; accountId: string }> {
  const email = `${name}@example.com`;
  const phone = `+8529${Math.floor(1000000 + Math.random() * 8999999)}`;
  await http().post("/v1/auth/register").send({ email, phone, password: PASSWORD, fullName: name, countryCode: "HK", language: "en" }).expect(202);
  await t.drain();
  await http().post("/v1/auth/otp/verify").send({ email, channel: "EMAIL", code: codeSentTo(t.email, email) }).expect(200);
  await http().post("/v1/auth/otp/verify").send({ email, channel: "SMS", code: codeSentTo(t.sms, phone) }).expect(200);
  const login = await http().post("/v1/auth/login").send({ email, password: PASSWORD, device: DEVICE }).expect(200);
  const access = login.body.tokens.accessToken as string;
  // Accounts are created on first use, so make the first account request before looking the account up.
  await http().get("/v1/accounts").set("Authorization", `Bearer ${access}`).expect(200);
  const me = await http().get("/v1/me").set("Authorization", `Bearer ${access}`).expect(200);
  const account = await t.container.db.account.findUniqueOrThrow({ where: { userId: me.body.id } });
  return { access, accountId: account.id };
}

const auth = (access: string) => ({ Authorization: `Bearer ${access}` });

describe("accounts", () => {
  it("creates the account with an HKD currency account on first use, and reports balances", async () => {
    const a = await customer("alice");
    const res = await http().get("/v1/accounts").set(auth(a.access)).expect(200);
    expect(res.body.accountRef).toMatch(/^HKA\d{8}$/);
    const hkd = res.body.currencies.find((c: { currency: string }) => c.currency === "HKD");
    expect(hkd).toMatchObject({ opened: true, available: { amountMinor: "0" } });
    expect(res.body.currencies.find((c: { currency: string }) => c.currency === "USD").opened).toBe(false);
  });

  it("opens another currency once, and says so on repeat", async () => {
    const a = await customer("bella");
    const first = await http().post("/v1/accounts/currencies").set(auth(a.access)).send({ currency: "USD" }).expect(200);
    expect(first.body).toEqual({ currency: "USD", opened: true });
    const again = await http().post("/v1/accounts/currencies").set(auth(a.access)).send({ currency: "USD" }).expect(200);
    expect(again.body.opened).toBe(false);
  });

  it("refuses a currency outside the launch list", async () => {
    const a = await customer("carl");
    const res = await http().post("/v1/accounts/currencies").set(auth(a.access)).send({ currency: "BTC" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("requires a session", async () => {
    expect((await http().get("/v1/accounts")).status).toBe(401);
    expect((await http().get("/v1/dashboard")).status).toBe(401);
  });
});

describe("dashboard", () => {
  it("shows cash, investment value separately, totals and recent activity once money is in", async () => {
    const a = await customer("dana");
    const empty = await http().get("/v1/dashboard").set(auth(a.access)).expect(200);
    expect(empty.body.cashTotal.amountMinor).toBe("0");

    await t.container.ledger.recordVerifiedDeposit({ customerId: a.accountId, currency: "HKD", amountMinor: 128_450_00n, providerRef: "P-DASH-1", idempotencyKey: "dash-dep-1-xyz" });
    const res = await http().get("/v1/dashboard").set(auth(a.access)).expect(200);
    expect(res.body.baseCurrency).toBe("HKD");
    expect(res.body.cashTotal).toEqual({ amountMinor: "12845000", display: "HK$ 128,450.00" });
    expect(res.body.totals.deposits.amountMinor).toBe("12845000");
    expect(res.body.investmentValue).toMatchObject({ marketValueMinor: "0", source: "Investments are not yet connected" });
    expect(res.body.recentActivity[0]).toMatchObject({ kind: "deposit", signedAmountMinor: "12845000", status: "posted" });
  });

  it("does not show one customer another customer's money or activity", async () => {
    const a = await customer("erin");
    const b = await customer("fred");
    await t.container.ledger.recordVerifiedDeposit({ customerId: a.accountId, currency: "HKD", amountMinor: 5000n, providerRef: "P-ISO", idempotencyKey: "iso-dep-1-xyz" });
    const bView = await http().get("/v1/dashboard").set(auth(b.access)).expect(200);
    expect(bView.body.cashTotal.amountMinor).toBe("0");
    expect(bView.body.recentActivity).toHaveLength(0);
  });

  it("lists transactions with a limit", async () => {
    const a = await customer("gina");
    for (let i = 0; i < 3; i++) {
      await t.container.ledger.recordVerifiedDeposit({ customerId: a.accountId, currency: "HKD", amountMinor: 100n, providerRef: `P-${i}`, idempotencyKey: `tx-list-${i}-xyz` });
    }
    const res = await http().get("/v1/transactions?limit=2").set(auth(a.access)).expect(200);
    expect(res.body.items).toHaveLength(2);
  });
});

describe("beneficiaries", () => {
  const recipient = { name: "David Wong", country: "SG", method: "swift", destination: "DBSSSGSG0000005521", currency: "SGD" };

  it("saves a recipient, shows only a masked destination, and stores it encrypted", async () => {
    const a = await customer("hana");
    const saved = await http().post("/v1/beneficiaries").set(auth(a.access)).send(recipient).expect(201);
    expect(saved.body.destination).toMatch(/•+5521$/);
    expect(JSON.stringify(saved.body)).not.toContain("DBSSSGSG0000005521");

    const row = await t.container.db.beneficiary.findFirstOrThrow({ where: { accountId: a.accountId } });
    expect(row.destinationEnc).not.toContain("DBSSSGSG");
    expect(row.destinationEnc).not.toBe(recipient.destination);
  });

  it("lists, then removes, a recipient; a removed recipient is no longer listed", async () => {
    const a = await customer("ivan");
    const saved = await http().post("/v1/beneficiaries").set(auth(a.access)).send(recipient).expect(201);
    expect((await http().get("/v1/beneficiaries").set(auth(a.access))).body.items).toHaveLength(1);
    await http().delete(`/v1/beneficiaries/${saved.body.id}`).set(auth(a.access)).expect(200);
    expect((await http().get("/v1/beneficiaries").set(auth(a.access))).body.items).toHaveLength(0);
  });

  it("refuses to remove another customer's recipient", async () => {
    const a = await customer("jade");
    const b = await customer("kai");
    const saved = await http().post("/v1/beneficiaries").set(auth(a.access)).send(recipient).expect(201);
    const res = await http().delete(`/v1/beneficiaries/${saved.body.id}`).set(auth(b.access));
    expect(res.status).toBe(404);
    expect((await http().get("/v1/beneficiaries").set(auth(a.access))).body.items).toHaveLength(1);
  });

  it("rejects an unknown field and a currency outside the launch list", async () => {
    const a = await customer("liam");
    const extra = await http().post("/v1/beneficiaries").set(auth(a.access)).send({ ...recipient, owner: "x" });
    expect(extra.status).toBe(400);
    const bad = await http().post("/v1/beneficiaries").set(auth(a.access)).send({ ...recipient, currency: "BTC" });
    expect(bad.status).toBe(400);
  });
});
