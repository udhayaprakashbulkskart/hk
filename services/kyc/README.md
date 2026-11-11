# @hkfinhub/kyc

Identity verification: onboarding details, documents, status and provider verdicts.

## What it does
- **State machine** (`TRANSITIONS` in `src/service.ts`): `NOT_STARTED → DOCUMENTS_PENDING → UNDER_REVIEW → VERIFIED | REJECTED | ADDITIONAL_INFO_REQUIRED`, with `SUSPENDED` and `EXPIRED` after verification. Every status change is checked against this table before the store is touched.
- **Identity numbers** (PAN, passport, date of birth) are encrypted with the field key (`encryptField`). Only masked forms are returned to callers.
- **Documents** are validated by their leading bytes (JPEG, PNG, PDF), not the client's label. Maximum 10 MB. SHA-256 is computed. The malware scanner runs before anything is stored. Each document gets its own data key, which is wrapped by the master key (`src/envelope.ts`). Only ciphertext reaches object storage.
- **Audited reads.** `readDocumentForReview` is the only route to a plaintext document. It requires `COMPLIANCE_ADMIN` and a reason of at least 10 characters. Denied attempts are audited too. The read audit row is written before any bytes are fetched. The stored checksum is verified after decryption, so a substituted document is refused with `INTEGRITY_FAILURE`.
- **Provider verdicts.** A `PASS` is held for review while a blocking compliance case is open on the user.

## Production posture
KMS, the malware scanner and the KYC vendor are passed in as `null` in production. The matching feature then returns `NOT_AVAILABLE`. Sandbox versions (`src/sandbox.ts`) are for development and tests only. The EICAR test string is flagged by the sandbox scanner.

## Not built
AWS KMS adapter, a real scanner, a real KYC vendor (D2), PAN and address verification against authorities, and the staff review queue (Phase 9).
