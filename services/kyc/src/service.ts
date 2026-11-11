import { createHash } from "node:crypto";
import { decryptField, encryptField, randomToken } from "@hkfinhub/authentication";
import { KycError } from "./errors";
import { decryptDocument, encryptDocument, type KeyManagement } from "./envelope";
import { ageOn, isPan, isPassportNumber, validateDocument } from "./validation";
import type { DocumentKind, KycFileRecord, KycProvider, KycProviderResult, KycStatus, KycStore, MalwareScanner, ObjectStorage } from "./ports";

export interface KycConfig {
  /** AES-256-GCM key for identity numbers and date of birth. */
  fieldKey: Uint8Array;
}

/**
 * Capabilities that are null are NOT AVAILABLE, and the service says so instead of pretending to work.
 * Production leaves the KMS, scanner and provider null until real adapters are approved and verified.
 */
export interface Deps {
  store: KycStore;
  storage: ObjectStorage | null;
  kms: KeyManagement | null;
  scanner: MalwareScanner | null;
  provider: KycProvider | null;
  config: KycConfig;
  now?: () => Date;
}

export type StaffRole = "COMPLIANCE_ADMIN" | "SUPPORT_ADMIN" | "FINANCE_ADMIN" | "SUPER_ADMIN";
export interface Actor {
  id: string;
  role: StaffRole | "CUSTOMER";
}

/** Legal transitions. Every status change is checked against this table before it reaches the store. */
export const TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  NOT_STARTED: ["DOCUMENTS_PENDING"],
  DOCUMENTS_PENDING: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED", "ADDITIONAL_INFO_REQUIRED"],
  ADDITIONAL_INFO_REQUIRED: ["DOCUMENTS_PENDING", "UNDER_REVIEW"],
  REJECTED: ["DOCUMENTS_PENDING"],
  VERIFIED: ["EXPIRED", "SUSPENDED"],
  SUSPENDED: ["VERIFIED", "UNDER_REVIEW"],
  EXPIRED: ["DOCUMENTS_PENDING"],
};

export const REQUIRED_FOR_SUBMISSION: DocumentKind[][] = [["PASSPORT", "HK_ID_CARD"], ["ADDRESS_PROOF"]];

export type ScreenFn = (subject: { dateOfBirth: string; country: string }) => Promise<void>;
const noScreen: ScreenFn = async () => {};

export class KycService {
  private readonly now: () => Date;
  constructor(private readonly d: Deps) {
    this.now = d.now ?? (() => new Date());
  }

  /** Current status, what is still missing, and masked identifiers. Never decrypted values. */
  async status(userId: string) {
    const rec = await this.d.store.ensureRecord(userId);
    const identity = await this.d.store.getIdentity(userId);
    const files = await this.d.store.listFiles(userId);
    const kinds = new Set(files.filter((f) => f.scanStatus === "CLEAN").map((f) => f.kind));
    const missing: string[] = [];
    if (!identity?.panMasked && !identity?.passportMasked) missing.push("PAN or passport number");
    if (!identity?.dateOfBirthEnc) missing.push("date of birth");
    for (const group of REQUIRED_FOR_SUBMISSION) {
      if (!group.some((k) => kinds.has(k))) missing.push(group.join(" or "));
    }
    return {
      status: rec.status,
      tier: rec.tier,
      verifiedAt: rec.verifiedAt?.toISOString() ?? null,
      rejectionReason: rec.rejectionReason,
      missing,
      identity: { pan: identity?.panMasked ?? null, passport: identity?.passportMasked ?? null, nationality: identity?.nationality ?? null },
      documents: files.map((f) => ({ id: f.id, kind: f.kind, sizeBytes: f.sizeBytes, mimeType: f.mimeType, scanStatus: f.scanStatus, uploadedAt: f.createdAt.toISOString() })),
      capabilities: { documentUploads: this.d.kms !== null && this.d.storage !== null && this.d.scanner !== null, submission: this.d.provider !== null },
    };
  }

  /** Saves identity numbers encrypted, and keeps only masked forms for display. */
  async saveIdentity(userId: string, input: { pan?: string | undefined; passport?: string | undefined; dateOfBirth: string; nationality: string }): Promise<void> {
    const pan = input.pan?.trim().toUpperCase();
    const passport = input.passport?.trim().toUpperCase();
    if (!pan && !passport) throw new KycError("INVALID_REQUEST", "enter a PAN or a passport number");
    if (pan && !isPan(pan)) throw new KycError("INVALID_REQUEST", "the PAN format is not valid");
    if (passport && !isPassportNumber(passport)) throw new KycError("INVALID_REQUEST", "the passport number format is not valid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) throw new KycError("INVALID_REQUEST", "date of birth must be YYYY-MM-DD");
    const dob = new Date(`${input.dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== input.dateOfBirth) throw new KycError("INVALID_REQUEST", "date of birth is not a real date");
    if (ageOn(dob, this.now()) < 18) throw new KycError("INVALID_REQUEST", "customers must be 18 or over");
    if (!/^[A-Z]{2}$/.test(input.nationality)) throw new KycError("INVALID_REQUEST", "nationality must be a two-letter country code");

    await this.d.store.ensureRecord(userId);
    const key = this.d.config.fieldKey;
    await this.d.store.upsertIdentity({
      userId,
      panEnc: pan ? encryptField(key, pan) : null,
      panMasked: pan ? mask(pan) : null,
      passportEnc: passport ? encryptField(key, passport) : null,
      passportMasked: passport ? mask(passport) : null,
      dateOfBirthEnc: encryptField(key, input.dateOfBirth),
      nationality: input.nationality,
    });
    await this.moveIfAllowed(userId, ["NOT_STARTED", "REJECTED", "EXPIRED"], "DOCUMENTS_PENDING");
    await this.d.store.audit({ actorUserId: userId, action: "kyc_identity_saved", subjectType: "User", subjectId: userId });
  }

  /** Stores an uploaded document encrypted, after checking its type and scanning it. */
  async uploadDocument(userId: string, input: { kind: DocumentKind; mimeType: string; body: Buffer }): Promise<KycFileRecord> {
    const { kms, storage, scanner } = this.documentDeps();
    const mime = validateDocument(input.body, input.mimeType);
    const rec = await this.d.store.ensureRecord(userId);
    if (rec.status === "VERIFIED" || rec.status === "UNDER_REVIEW") throw new KycError("INVALID_TRANSITION", "documents cannot be changed while your identity is being reviewed");
    const checksum = createHash("sha256").update(input.body).digest("hex");
    const verdict = await scanner.scan(input.body);
    if (verdict === "INFECTED") {
      await this.d.store.audit({ actorUserId: userId, action: "kyc_upload_malware", subjectType: "User", subjectId: userId, metadata: { kind: input.kind } });
      throw new KycError("MALWARE_DETECTED", "this file could not be accepted. Upload an original copy from your device.");
    }
    const { ciphertext, wrappedKey } = await encryptDocument(kms, input.body);
    const storageKey = `kyc/${userId}/${randomToken(18)}`;
    await storage.put(storageKey, ciphertext);
    const file: KycFileRecord = {
      id: crypto.randomUUID(),
      userId,
      kind: input.kind,
      storageKey,
      checksumSha256: checksum,
      sizeBytes: input.body.length,
      mimeType: mime,
      wrappedKey,
      scanStatus: "CLEAN",
      createdAt: this.now(),
    };
    await this.d.store.addFile(file);
    await this.d.store.audit({ actorUserId: userId, action: "kyc_document_uploaded", subjectType: "KycFile", subjectId: file.id, metadata: { kind: input.kind } });
    return file;
  }

  /**
   * Sends the case for identity checking. `screen` runs sanctions screening first, so a hit exists before
   * the provider can return a verdict. The provider's PASS is then held while that case is open.
   */
  async submit(userId: string, fullName: string, screen: ScreenFn = noScreen): Promise<{ status: KycStatus; providerRef: string }> {
    const provider = this.d.provider;
    if (!provider) throw new KycError("NOT_AVAILABLE", "identity checks are not yet available");
    if (fullName.trim().length < 2) throw new KycError("INVALID_REQUEST", "the full name is required for identity checking");
    const s = await this.status(userId);
    if (s.missing.length > 0) throw new KycError("INCOMPLETE", `still needed: ${s.missing.join("; ")}`);
    const identity = await this.d.store.getIdentity(userId);
    const dob = decryptField(this.d.config.fieldKey, identity!.dateOfBirthEnc!);
    const country = identity?.nationality ?? "HK";
    await screen({ dateOfBirth: dob, country });
    const check = await provider.startCheck({ userId, fullName: fullName.trim(), dateOfBirth: dob, countryCode: country });
    const moved = await this.moveTransition(userId, ["DOCUMENTS_PENDING", "ADDITIONAL_INFO_REQUIRED"], "UNDER_REVIEW", { providerRef: check.providerRef });
    if (!moved) throw new KycError("INVALID_TRANSITION", "this case cannot be submitted now");
    await this.d.store.audit({ actorUserId: userId, action: "kyc_submitted", subjectType: "User", subjectId: userId });
    return { status: "UNDER_REVIEW", providerRef: check.providerRef };
  }

  /** Applies the identity provider's verdict. A PASS grants the standard tier only with no blocking case open. */
  async applyProviderResult(input: KycProviderResult, opts: { hasBlockingCase: (userId: string) => Promise<boolean> }): Promise<KycStatus> {
    const rec = await this.d.store.findByProviderRef(input.providerRef);
    if (!rec) throw new KycError("NOT_FOUND", "no case for this provider reference");
    const now = this.now();
    if (input.outcome === "PASS") {
      if (await opts.hasBlockingCase(rec.userId)) {
        await this.d.store.audit({ actorUserId: null, action: "kyc_pass_held", subjectType: "User", subjectId: rec.userId });
        return "UNDER_REVIEW";
      }
      await this.moveTransition(rec.userId, ["UNDER_REVIEW", "SUSPENDED"], "VERIFIED", { tier: "STANDARD", verifiedAt: now, rejectionReason: null });
      await this.d.store.audit({ actorUserId: null, action: "kyc_verified", subjectType: "User", subjectId: rec.userId });
      return "VERIFIED";
    }
    if (input.outcome === "FAIL") {
      await this.moveTransition(rec.userId, ["UNDER_REVIEW"], "REJECTED", { rejectionReason: input.reason ?? "identity could not be confirmed" });
      await this.d.store.audit({ actorUserId: null, action: "kyc_rejected", subjectType: "User", subjectId: rec.userId });
      return "REJECTED";
    }
    return "UNDER_REVIEW";
  }

  /** Staff decision on a case. Requires a reason, and only the compliance role may decide. */
  async decide(actor: Actor, userId: string, decision: "APPROVE" | "REJECT" | "REQUEST_INFO", reason: string): Promise<KycStatus> {
    if (actor.role !== "COMPLIANCE_ADMIN") throw new KycError("FORBIDDEN", "only compliance staff can decide identity cases");
    if (reason.trim().length < 10) throw new KycError("INVALID_REQUEST", "give a reason of at least 10 characters");
    const target: KycStatus = decision === "APPROVE" ? "VERIFIED" : decision === "REJECT" ? "REJECTED" : "ADDITIONAL_INFO_REQUIRED";
    const patch = decision === "APPROVE" ? { tier: "STANDARD" as const, verifiedAt: this.now(), rejectionReason: null } : { rejectionReason: reason.trim().slice(0, 200) };
    const moved = await this.moveTransition(userId, ["UNDER_REVIEW"], target, patch);
    if (!moved) throw new KycError("INVALID_TRANSITION", "this case is not awaiting a decision");
    await this.d.store.audit({ actorUserId: actor.id, action: `kyc_decision_${decision.toLowerCase()}`, subjectType: "User", subjectId: userId, metadata: { reason: reason.trim() } });
    return target;
  }

  /**
   * The only way to read an identity document. Denied attempts are audited too. The audit row is written
   * before any bytes are fetched, so no successful read can happen without a record.
   */
  async readDocumentForReview(actor: Actor, fileId: string, reason: string): Promise<{ body: Buffer; file: KycFileRecord }> {
    const allowed = actor.role === "COMPLIANCE_ADMIN" && reason.trim().length >= 10;
    if (!allowed) {
      await this.d.store.audit({ actorUserId: actor.id, action: "kyc_document_read_denied", subjectType: "KycFile", subjectId: fileId, metadata: { role: actor.role, reasonGiven: reason.trim().length > 0 } });
      throw new KycError("FORBIDDEN", "documents can be read only by compliance staff, with a reason");
    }
    const { kms, storage } = this.documentDeps();
    const file = await this.d.store.getFile(fileId);
    if (!file) throw new KycError("NOT_FOUND", "document not found");
    await this.d.store.audit({ actorUserId: actor.id, action: "kyc_document_read", subjectType: "KycFile", subjectId: fileId, metadata: { reason: reason.trim(), owner: file.userId } });
    const stored = await storage.get(file.storageKey);
    if (!stored) throw new KycError("NOT_FOUND", "document content is missing");
    const body = await decryptDocument(kms, stored, file.wrappedKey);
    if (createHash("sha256").update(body).digest("hex") !== file.checksumSha256) {
      await this.d.store.audit({ actorUserId: actor.id, action: "kyc_document_integrity_failure", subjectType: "KycFile", subjectId: fileId });
      throw new KycError("INTEGRITY_FAILURE", "the stored document does not match its checksum");
    }
    return { body, file };
  }

  private documentDeps() {
    const { kms, storage, scanner } = this.d;
    if (!kms || !storage || !scanner) throw new KycError("NOT_AVAILABLE", "document uploads are not yet available");
    return { kms, storage, scanner };
  }

  private async moveIfAllowed(userId: string, from: KycStatus[], to: KycStatus): Promise<void> {
    const rec = await this.d.store.getRecord(userId);
    if (rec && from.includes(rec.status)) await this.moveTransition(userId, from, to);
  }

  /** Every status change goes through here, so an illegal edge is refused even if a caller lists it. */
  private async moveTransition(userId: string, from: KycStatus[], to: KycStatus, patch?: Parameters<KycStore["moveStatus"]>[3]): Promise<boolean> {
    for (const f of from) {
      if (!TRANSITIONS[f].includes(to)) throw new KycError("INVALID_TRANSITION", `${f} cannot move to ${to}`);
    }
    return this.d.store.moveStatus(userId, from, to, patch);
  }
}

function mask(value: string): string {
  return `${"•".repeat(Math.max(2, value.length - 4))}${value.slice(-4)}`;
}
