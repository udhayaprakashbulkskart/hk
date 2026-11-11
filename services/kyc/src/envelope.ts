import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for identity documents. Each document gets its own random 256-bit data key.
 * The data key is wrapped by the master key (KMS). Only the ciphertext and the wrapped key are stored.
 */
export interface KeyManagement {
  wrap(dataKey: Buffer): Promise<string>;
  unwrap(wrapped: string): Promise<Buffer>;
}

/** Local key management for development and tests. Production uses AWS KMS (decision D11 region). */
export function createLocalKms(masterKey: Buffer): KeyManagement {
  if (masterKey.length !== 32) throw new Error("master key must be 32 bytes");
  return {
    async wrap(dataKey) {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", masterKey, iv);
      const ct = Buffer.concat([c.update(dataKey), c.final()]);
      return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
    },
    async unwrap(wrapped) {
      const buf = Buffer.from(wrapped, "base64");
      const d = createDecipheriv("aes-256-gcm", masterKey, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
    },
  };
}

export async function encryptDocument(kms: KeyManagement, plain: Buffer): Promise<{ ciphertext: Buffer; wrappedKey: string }> {
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", dek, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  const ciphertext = Buffer.concat([iv, c.getAuthTag(), body]);
  const wrappedKey = await kms.wrap(dek);
  dek.fill(0);
  return { ciphertext, wrappedKey };
}

export async function decryptDocument(kms: KeyManagement, ciphertext: Buffer, wrappedKey: string): Promise<Buffer> {
  const dek = await kms.unwrap(wrappedKey);
  const d = createDecipheriv("aes-256-gcm", dek, ciphertext.subarray(0, 12));
  d.setAuthTag(ciphertext.subarray(12, 28));
  const out = Buffer.concat([d.update(ciphertext.subarray(28)), d.final()]);
  dek.fill(0);
  return out;
}
