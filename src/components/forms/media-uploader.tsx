"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Film, Plus, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui/states";

export type MediaItem = { url: string; type: "IMAGE" | "VIDEO" | "SPIN" };
type Sign = { driver: "local" } | { driver: "vercel-blob" } | { driver: "cloudinary"; cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string };

const IMG = ["image/jpeg", "image/png", "image/webp"];
const VID = ["video/mp4", "video/webm"];

async function uploadOne(file: File): Promise<{ ok: true; item: MediaItem } | { ok: false; error: string }> {
  const sign = await api<Sign>("/api/uploads/sign");
  if (!sign.ok) return { ok: false, error: sign.error };
  if (sign.data.driver === "vercel-blob") {
    try {
      const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
      const blob = await upload(`listings/${safe}`, file, { access: "public", handleUploadUrl: "/api/uploads/blob", contentType: file.type });
      return { ok: true, item: { url: blob.url, type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE" } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.replace(/^Vercel Blob: /, "") : "Upload failed" };
    }
  }
  const form = new FormData();
  form.append("file", file);
  if (sign.data.driver === "cloudinary") {
    const s = sign.data;
    form.append("api_key", s.apiKey);
    form.append("timestamp", String(s.timestamp));
    form.append("folder", s.folder);
    form.append("signature", s.signature);
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/${kind}/upload`, { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.secure_url) return { ok: false, error: json?.error?.message ?? "Upload failed" };
    return { ok: true, item: { url: json.secure_url, type: kind === "video" ? "VIDEO" : "IMAGE" } };
  }
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) return { ok: false, error: json?.error ?? "Upload failed" };
  return { ok: true, item: json.data };
}

/** Upload up to 5 images and 1 video, with client-side type/size checks (re-validated server-side). */
export function MediaUploader({ value, onChange, error }: { value: MediaItem[]; onChange: (v: MediaItem[]) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const images = value.filter((m) => m.type === "IMAGE");
  const video = value.find((m) => m.type === "VIDEO");
  const spin = value.filter((m) => m.type === "SPIN");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    let next = [...value];
    setBusy(true);
    for (const f of Array.from(files)) {
      const isImg = IMG.includes(f.type);
      const isVid = VID.includes(f.type);
      if (!isImg && !isVid) { setMsg(`${f.name}: use JPG, PNG, WEBP, MP4 or WEBM`); continue; }
      if (isImg && f.size > 5 * 1024 * 1024) { setMsg(`${f.name}: images must be under 5 MB`); continue; }
      if (isVid && f.size > 25 * 1024 * 1024) { setMsg(`${f.name}: videos must be under 25 MB`); continue; }
      if (isImg && next.filter((m) => m.type === "IMAGE").length >= 5) { setMsg("Maximum 5 images"); continue; }
      if (isVid && next.some((m) => m.type === "VIDEO")) { setMsg("Only 1 video allowed"); continue; }
      const r = await uploadOne(f);
      if (!r.ok) { setMsg(r.error); continue; }
      next = [...next, r.item];
      onChange(next);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  const remove = (url: string) => onChange(value.filter((m) => m.url !== url));
  return (
    <div>
      <p className="label">Item images & video <span className="text-neon">*</span> <span className="font-normal text-zinc-500">(max 5 images + 1 video)</span></p>
      <div className="flex flex-wrap gap-3">
        {images.map((m, i) => (
          <div key={m.url} className="relative size-24 overflow-hidden rounded-xl border border-line bg-black">
            <Image src={m.url} alt={`Image ${i + 1}`} fill sizes="96px" className="object-cover" unoptimized={m.url.endsWith(".svg") || m.url.startsWith("/uploads/")} />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px]">Cover</span>}
            <button type="button" onClick={() => remove(m.url)} aria-label={`Remove image ${i + 1}`} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-neon"><X className="size-3.5" /></button>
          </div>
        ))}
        {video && (
          <div className="relative grid size-24 place-items-center rounded-xl border border-line bg-panel-2">
            <Film className="size-7 text-neon" />
            <button type="button" onClick={() => remove(video.url)} aria-label="Remove video" className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-neon"><X className="size-3.5" /></button>
          </div>
        )}
        {(images.length < 5 || !video) && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-line text-xs text-muted transition hover:border-neon/60 hover:text-white">
            {busy ? <Spinner className="size-5" /> : <span className="flex flex-col items-center gap-1"><Plus className="size-5" /> Add</span>}
          </button>
        )}
      </div>
      {spin.length > 0 && <p className="mt-2 text-xs text-muted">Includes a {spin.length}-frame 360° view.</p>}
      <input ref={input} type="file" multiple accept={[...IMG, ...VID].join(",")} className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {(msg || error) && <p className="mt-1.5 text-xs text-neon-soft">{msg || error}</p>}
    </div>
  );
}
