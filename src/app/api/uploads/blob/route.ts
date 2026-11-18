import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { IMAGE_TYPES, MAX_VIDEO_BYTES, VIDEO_TYPES, storageDriver } from "@/lib/storage";

/**
 * Issues short-lived Vercel Blob client-upload tokens. The browser then uploads the file
 * straight to Blob storage. Only signed-in users get tokens, limited to image/video types,
 * 25 MB, the listings/ prefix, and a random suffix so files can't overwrite each other.
 */
export async function POST(req: Request) {
  if (storageDriver() !== "vercel-blob") return NextResponse.json({ error: "Blob storage is not enabled" }, { status: 404 });
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await requireUser();
        await rateLimit(`upload:${user.id}`, 60, 3600);
        if (!pathname.startsWith("listings/") || pathname.includes("..")) throw new ApiError(400, "Invalid upload path");
        return {
          allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status });
  }
}
