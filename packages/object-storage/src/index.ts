import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Private object storage for encrypted documents. Callers store ciphertext only: this layer never sees
 * plaintext identity documents. The bucket must block public access (enforced in infrastructure).
 */
export interface ObjectStore {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

/** In-memory store. Tests and the test only: content is lost on restart. */
export function createMemoryObjectStore(): ObjectStore & { keys(): string[] } {
  const items = new Map<string, Buffer>();
  return {
    async put(key, body) {
      items.set(key, Buffer.from(body));
    },
    async get(key) {
      const v = items.get(key);
      return v ? Buffer.from(v) : null;
    },
    keys: () => [...items.keys()],
  };
}

/**
 * S3 adapter with SSE-KMS. UNVERIFIED against AWS: written from the SDK's documented commands and exercised
 * only through the SDK's own client interface in tests. Verify in a test bucket before storing real documents.
 */
export function createS3ObjectStore(opts: { bucket: string; region: string; kmsKeyId: string; client?: S3Client }): ObjectStore {
  const client = opts.client ?? new S3Client({ region: opts.region });
  return {
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: key,
          Body: body,
          ContentType: "application/octet-stream",
          ServerSideEncryption: "aws:kms",
          SSEKMSKeyId: opts.kmsKeyId,
        }),
      );
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: opts.bucket, Key: key }));
        if (!out.Body) return null;
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (err) {
        if (err instanceof Error && err.name === "NoSuchKey") return null;
        throw err;
      }
    },
  };
}
