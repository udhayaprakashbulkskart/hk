import { ComplianceService, createSandboxScreener, createUnconfiguredScreener, type KycTier, type MonitoringPolicy } from "@hkfinhub/compliance";
import { createLocalKms, createSandboxKycProvider, createSandboxScanner, KycService, type KeyManagement, type KycProvider, type MalwareScanner } from "@hkfinhub/kyc";
import { PrismaComplianceStore, PrismaKycStore, type Database } from "@hkfinhub/database";
import { createMemoryObjectStore, createS3ObjectStore, type ObjectStore } from "@hkfinhub/object-storage";
import type { ApiConfig } from "./config";

export interface KycServices {
  kyc: KycService;
  compliance: ComplianceService;
}

/**
 * Production posture: KMS, malware scanning, the KYC vendor and sanctions screening are NOT yet approved or
 * verified (decisions D2, D11, D15). Each stays null or unconfigured in production, so the matching feature
 * reports NOT_AVAILABLE. Sandbox versions are used everywhere else, and every one is labelled as such.
 */
export function buildKycServices(db: Database, config: ApiConfig): KycServices {
  const production = config.appEnv === "production";
  const kycStore = new PrismaKycStore(db);
  const complianceStore = new PrismaComplianceStore(db);

  const kms: KeyManagement | null = config.kyc.masterKey && !production ? createLocalKms(config.kyc.masterKey) : null;
  const storage: ObjectStore | null = config.kyc.bucket && config.kyc.kmsKeyId
    ? createS3ObjectStore({ bucket: config.kyc.bucket, region: config.kyc.region, kmsKeyId: config.kyc.kmsKeyId })
    : production
      ? null
      : createMemoryObjectStore();
  const scanner: MalwareScanner | null = production ? null : createSandboxScanner();
  const provider: KycProvider | null = production ? null : createSandboxKycProvider();

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
    screener: production ? createUnconfiguredScreener() : createSandboxScreener(),
    kycTier,
    policy,
  });

  return { kyc, compliance };
}
