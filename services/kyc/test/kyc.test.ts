import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLocalKms, decryptDocument, encryptDocument, KycError, KycService, TRANSITIONS } from "../src";
import { createSandboxScanner, createSandboxKycProvider, EICAR_TEST_STRING } from "./doubles";
import { createMemoryObjectStore } from "../../../packages/object-storage/src";
import { createMemoryKycStore } from "./memory-store";

const fieldKey = randomBytes(32);
const kms = createLocalKms(randomBytes(32));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake image body for tests")]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("jpeg body")]);
const PDF = Buffer.from("%PDF-1.7 test body");
const staff = { id: "staff-1", role: "COMPLIANCE_ADMIN" as const };
const support = { id: "staff-2", role: "SUPPORT_ADMIN" as const };

function build(opts: { now?: Date } = {}) {
  const store = createMemoryKycStore();
  const storage = createMemoryObjectStore();
  const svc = new KycService({
    store,
    storage,
    kms,
    scanner: createSandboxScanner(),
    provider: createSandboxKycProvider(),
    config: { fieldKey },
    now: () => opts.now ?? new Date("2026-11-11T00:00:00Z"),
  });
  return { svc, store, storage };
}

async function readyUser(svc: KycService, userId: string) {
  await svc.saveIdentity(userId, { pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" });
  await svc.uploadDocument(userId, { kind: "PASSPORT", mimeType: "image/png", body: PNG });
  await svc.uploadDocument(userId, { kind: "ADDRESS_PROOF", mimeType: "application/pdf", body: PDF });
}

describe("envelope encryption", () => {
  it("round-trips a document and the stored bytes are not the plaintext", async () => {
    const plain = Buffer.from("secret passport scan");
    const { ciphertext, wrappedKey } = await encryptDocument(kms, plain);
    expect(ciphertext.includes(plain)).toBe(false);
    expect(wrappedKey.length).toBeGreaterThan(0);
    expect((await decryptDocument(kms, ciphertext, wrappedKey)).equals(plain)).toBe(true);
  });
  it("fails to decrypt when the ciphertext is altered", async () => {
    const { ciphertext, wrappedKey } = await encryptDocument(kms, Buffer.from("payload"));
    ciphertext[ciphertext.length - 1]! ^= 0xff;
    await expect(decryptDocument(kms, ciphertext, wrappedKey)).rejects.toThrow();
  });
  it("uses a fresh data key per document", async () => {
    const a = await encryptDocument(kms, Buffer.from("same"));
    const b = await encryptDocument(kms, Buffer.from("same"));
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });
});

describe("identity details", () => {
  it("stores PAN and date of birth encrypted, and only a masked PAN is returned", async () => {
    const { svc, store } = build();
    await svc.saveIdentity("u1", { pan: "abcde1234f", dateOfBirth: "1990-05-01", nationality: "HK" });
    const row = (await store.getIdentity("u1"))!;
    expect(row.panEnc).not.toContain("ABCDE");
    expect(row.dateOfBirthEnc).not.toContain("1990");
    const status = await svc.status("u1");
    expect(status.identity.pan).toMatch(/4F$/);
    expect(JSON.stringify(status)).not.toContain("ABCDE1234F");
  });
  it("rejects a malformed PAN and customers under 18", async () => {
    const { svc } = build();
    await expect(svc.saveIdentity("u1", { pan: "BAD", dateOfBirth: "1990-05-01", nationality: "HK" })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(svc.saveIdentity("u1", { pan: "ABCDE1234F", dateOfBirth: "2010-01-01", nationality: "HK" })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("documents", () => {
  it("rejects a file whose bytes do not match the declared type", async () => {
    const { svc } = build();
    await expect(svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "application/pdf", body: PNG })).rejects.toMatchObject({ code: "FILE_REJECTED" });
  });
  it("rejects an unknown file type and an empty file", async () => {
    const { svc } = build();
    await expect(svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "text/plain", body: Buffer.from("hello") })).rejects.toMatchObject({ code: "FILE_REJECTED" });
    await expect(svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: Buffer.alloc(0) })).rejects.toMatchObject({ code: "FILE_REJECTED" });
  });
  it("rejects a file over 10 MB", async () => {
    const { svc } = build();
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10 * 1024 * 1024)]);
    await expect(svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: big })).rejects.toMatchObject({ code: "FILE_REJECTED" });
  });
  it("refuses an infected file and audits the attempt", async () => {
    const { svc, store, storage } = build();
    const infected = Buffer.concat([JPG, Buffer.from(EICAR_TEST_STRING, "latin1")]);
    await expect(svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: infected })).rejects.toMatchObject({ code: "MALWARE_DETECTED" });
    expect(storage.keys()).toHaveLength(0);
    expect(store.auditLog.some((a) => a.action === "kyc_upload_malware")).toBe(true);
  });
  it("stores ciphertext, not the uploaded bytes", async () => {
    const { svc, storage } = build();
    const f = await svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: JPG });
    const stored = (await storage.get(f.storageKey))!;
    expect(stored.includes(JPG)).toBe(false);
    expect(f.checksumSha256).toHaveLength(64);
  });
});

describe("audited document reads", () => {
  it("returns the plaintext to compliance staff and writes an audit row first", async () => {
    const { svc, store } = build();
    const f = await svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: JPG });
    const { body } = await svc.readDocumentForReview(staff, f.id, "identity check for case review");
    expect(body.equals(JPG)).toBe(true);
    expect(store.auditLog.map((a) => a.action)).toContain("kyc_document_read");
  });
  it("denies a support admin and audits the denial", async () => {
    const { svc, store } = build();
    const f = await svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: JPG });
    await expect(svc.readDocumentForReview(support, f.id, "trying to look at this")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.auditLog.map((a) => a.action)).toContain("kyc_document_read_denied");
  });
  it("refuses a read with no real reason, even for compliance staff", async () => {
    const { svc, store } = build();
    const f = await svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: JPG });
    await expect(svc.readDocumentForReview(staff, f.id, "ok")).rejects.toBeInstanceOf(KycError);
    expect(store.auditLog.map((a) => a.action)).not.toContain("kyc_document_read");
  });
  it("detects a stored document that no longer matches its checksum", async () => {
    const { svc, store, storage } = build();
    const f = await svc.uploadDocument("u1", { kind: "PASSPORT", mimeType: "image/jpeg", body: JPG });
    // A whole document is swapped: new ciphertext and its own wrapped key. Decryption succeeds,
    // so only the stored checksum can catch the substitution.
    const other = await encryptDocument(kms, Buffer.from("tampered content"));
    await storage.put(f.storageKey, other.ciphertext);
    store.tamper(f.id, { wrappedKey: other.wrappedKey });
    await expect(svc.readDocumentForReview(staff, f.id, "integrity check for review")).rejects.toMatchObject({ code: "INTEGRITY_FAILURE" });
  });
});

describe("state machine", () => {
  it("allows the normal path from not started to verified", async () => {
    const { svc, store } = build();
    await readyUser(svc, "u1");
    const sub = await svc.submit("u1", "Test Customer");
    expect(sub.status).toBe("UNDER_REVIEW");
    expect(await svc.decide(staff, "u1", "APPROVE", "documents match the record")).toBe("VERIFIED");
    expect((await store.getRecord("u1"))!.tier).toBe("STANDARD");
  });
  it("refuses a submission that is missing documents", async () => {
    const { svc } = build();
    await svc.saveIdentity("u1", { pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" });
    await expect(svc.submit("u1", "Test Customer")).rejects.toMatchObject({ code: "INCOMPLETE" });
  });
  it("refuses a move the transition table does not allow", async () => {
    expect(TRANSITIONS.NOT_STARTED).not.toContain("UNDER_REVIEW");
    expect(TRANSITIONS.VERIFIED).not.toContain("UNDER_REVIEW");
  });
  it("refuses a decision by a non-compliance role and needs a reason", async () => {
    const { svc } = build();
    await readyUser(svc, "u1");
    await svc.submit("u1", "Test Customer");
    await expect(svc.decide(support, "u1", "APPROVE", "documents match the record")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.decide(staff, "u1", "APPROVE", "short")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
  it("applies a provider FAIL as rejection with a reason", async () => {
    const { svc, store } = build();
    await readyUser(svc, "u1");
    const { providerRef } = await svc.submit("u1", "Test Customer");
    const out = await svc.applyProviderResult({ providerRef, outcome: "FAIL", reason: "name mismatch" }, { hasBlockingCase: async () => false });
    expect(out).toBe("REJECTED");
    expect((await store.getRecord("u1"))!.rejectionReason).toBe("name mismatch");
  });
  it("holds a provider PASS for review while a blocking case is open", async () => {
    const { svc } = build();
    await readyUser(svc, "u1");
    const { providerRef } = await svc.submit("u1", "Test Customer");
    const out = await svc.applyProviderResult({ providerRef, outcome: "PASS" }, { hasBlockingCase: async () => true });
    expect(out).toBe("UNDER_REVIEW");
  });
});
