import { ComplianceService, createUnconfiguredScreener, type KycTier, type MonitoringPolicy, type SanctionsScreener } from "@hkfinhub/compliance";
import { createLocalKms, KycService, type KeyManagement, type KycProvider, type MalwareScanner } from "@hkfinhub/kyc";
import { PrismaComplianceStore, PrismaKycStore, type Database } from "@hkfinhub/database";
import { createS3ObjectStore, type ObjectStore } from "@hkfinhub/object-storage";
import type { ApiConfig } from "./config";

export interface KycServices {
  kyc: KycService;
  compliance: ComplianceService;
}

/**
 * Production posture: KMS, malware scanning, the KYC vendor and sanctions screening are NOT yet approved or
 * verified (decisions D2, D11, D15). Each stays null or unconfigured in production, so the matching feature
 * reports NOT_AVAILABLE. No simulated provider exists in the runtime.
 */
export interface KycOverrides {
  /** Test doubles only. The runtime never supplies these. */
  scanner?: MalwareScanner | undefined;
  provider?: KycProvider | undefined;
  screener?: SanctionsScreener | undefined;
  storage?: ObjectStore | undefined;
}

export function buildKycServices(db: Database, config: ApiConfig, overrides: KycOverrides = {}): KycServices {
  const production = config.appEnv === "production";
  const kycStore = new PrismaKycStore(db);
  const complianceStore = new PrismaComplianceStore(db);

  const kms: KeyManagement | null = config.kyc.masterKey && !production ? createLocalKms(config.kyc.masterKey) : null;
  // Storage only with a configured private bucket. Without one, uploads are not available.
  const storage: ObjectStore | null = overrides.storage ?? (config.kyc.bucket && config.kyc.kmsKeyId
    ? createS3ObjectStore({ bucket: config.kyc.bucket, region: config.kyc.region, kmsKeyId: config.kyc.kmsKeyId })
    : null);
  // No scanner and no identity provider until real, approved ones are configured. Uploads and submission refuse.
  const scanner: MalwareScanner | null = overrides.scanner ?? null;
  const provider: KycProvider | null = overrides.provider ?? null;

  const kyc = new KycService({ store: kycStore, storage, kms, scanner, provider, config: { fieldKey: config.fieldKey } });

  const kycTier = async (userId: string): Promise<KycTier | null> => {
    const r = await kycStore.getRecord(userId);
    return r && r.status === "VERIFIED" ? ((r.tier === "BASIC" ? "STANDARD" : r.tier) as KycTier) : null;
  };

  // Starting values for the velocity and structuring rules. These are policy inputs for compliance to confirm.
  const policy: MonitoringPolicy = {
    velocity: { windowMs: 60 * 60_000, maxCount: 5 },
    structuring: { threshold: 10_000_000n, lowerBound: 9_000_000n, windowMs: 24 * 60 * 60_000, minCount: 3 },
  };

  const compliance = new ComplianceService({
    store: complianceStore,
    // Sanctions screening fails closed until a vendor is approved (D2). Tests inject a screener.
    screener: overrides.screener ?? createUnconfiguredScreener(),
    kycTier,
    policy,
  });

  return { kyc, compliance };
}
