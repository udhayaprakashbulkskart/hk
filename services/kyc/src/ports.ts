export type DocumentKind = "PASSPORT" | "HK_ID_CARD" | "ADDRESS_PROOF" | "PAN_CARD";
export type KycStatus =
  | "NOT_STARTED" | "DOCUMENTS_PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED"
  | "ADDITIONAL_INFO_REQUIRED" | "EXPIRED" | "SUSPENDED";
export type ScanStatus = "CLEAN" | "INFECTED";

export interface KycRecord {
  userId: string;
  status: KycStatus;
  tier: "BASIC" | "STANDARD" | "ENHANCED";
  providerRef: string | null;
  rejectionReason: string | null;
  verifiedAt: Date | null;
}

export interface IdentityRecord {
  userId: string;
  panEnc: string | null;
  panMasked: string | null;
  passportEnc: string | null;
  passportMasked: string | null;
  dateOfBirthEnc: string | null;
  nationality: string | null;
}

export interface KycFileRecord {
  id: string;
  userId: string;
  kind: DocumentKind;
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
  mimeType: string;
  wrappedKey: string;
  scanStatus: ScanStatus;
  createdAt: Date;
}

export interface KycStore {
  transaction<T>(fn: (tx: KycStore) => Promise<T>): Promise<T>;
  ensureRecord(userId: string): Promise<KycRecord>;
  getRecord(userId: string): Promise<KycRecord | null>;
  findByProviderRef(providerRef: string): Promise<KycRecord | null>;
  /** Compare-and-set on status. */
  moveStatus(userId: string, from: KycStatus[], to: KycStatus, patch?: Partial<Pick<KycRecord, "providerRef" | "rejectionReason" | "tier" | "verifiedAt">>): Promise<boolean>;
  getIdentity(userId: string): Promise<IdentityRecord | null>;
  upsertIdentity(identity: IdentityRecord): Promise<void>;
  addFile(f: KycFileRecord): Promise<void>;
  listFiles(userId: string): Promise<KycFileRecord[]>;
  getFile(id: string): Promise<KycFileRecord | null>;
  audit(entry: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> }): Promise<void>;
}

/** Private object storage. Holds ciphertext only. Adapters: in-memory (tests), S3 (production). */
export interface ObjectStorage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export interface MalwareScanner {
  scan(body: Buffer): Promise<ScanStatus>;
}

export interface KycProviderResult {
  providerRef: string;
  outcome: "PASS" | "FAIL" | "REVIEW";
  reason?: string;
}

/** Identity verification vendor (decision D2). The contract, not the vendor. */
export interface KycProvider {
  readonly id: string;
  startCheck(input: { userId: string; fullName: string; dateOfBirth: string; countryCode: string }): Promise<{ providerRef: string }>;
}
