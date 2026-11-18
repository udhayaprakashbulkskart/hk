import "server-only";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "./errors";

/**
 * Media storage. Three drivers:
 *  - "vercel-blob": the browser uploads directly to Vercel Blob with a short-lived client token
 *    issued by /api/uploads/blob (auth + type/size limits enforced when the token is issued).
 *  - "cloudinary": the browser uploads directly to Cloudinary using a short-lived signature
 *    issued by /api/uploads/sign.
 *  - "local": dev-only; files are written to public/uploads by /api/uploads.
 * Direct uploads keep large videos off serverless function body limits.
 */
export type StorageDriver = "vercel-blob" | "cloudinary" | "local";
export function storageDriver(): StorageDriver {
  const d = process.env.STORAGE_DRIVER;
  if (d === "vercel-blob" || d === "cloudinary") return d;
  return "local";
}

/** Public hostname of *our* Blob store, derived from the read-write token (vercel_blob_rw_<storeId>_<secret>). */
export function blobPublicHost() {
  const storeId = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

/** Validates by magic bytes (not the client-supplied MIME type) and stores locally. */
export async function saveLocalUpload(file: File) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_UPLOADS !== "true") {
    throw new ApiError(503, "File storage is not configured. Set STORAGE_DRIVER=cloudinary.");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) throw new ApiError(415, "Unsupported file. Use JPG, PNG, WEBP, MP4 or WEBM.");
  const isVideo = type.startsWith("video/");
  if (buf.length > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    throw new ApiError(413, isVideo ? "Videos must be under 25 MB" : "Images must be under 5 MB");
  }
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" }[type];
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${name}`, type: isVideo ? ("VIDEO" as const) : ("IMAGE" as const) };
}

/** Signature for a direct browser → Cloudinary signed upload. */
export function cloudinarySignature(folder = "pubg-store") {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new ApiError(503, "Cloudinary is not configured");
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + secret).digest("hex");
  return { cloudName: cloud, apiKey: key, timestamp, folder, signature };
}

/** Only accept media hosted by us or our configured Cloudinary account. */
export function isAllowedMediaUrl(url: string) {
  if (url.startsWith("/uploads/") || url.startsWith("/art/")) return !url.includes("..");
  const blobHost = blobPublicHost();
  if (blobHost && url.startsWith(`https://${blobHost}/`)) return true;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud && url.startsWith(`https://res.cloudinary.com/${cloud}/`));
}
