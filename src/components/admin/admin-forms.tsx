"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiForm } from "@/components/forms/use-api-form";
import { MediaUploader, type MediaItem } from "@/components/forms/media-uploader";

export function CommissionForm({ commissionPercent, autoCompleteDays }: { commissionPercent: number; autoCompleteDays: number }) {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  const router = useRouter();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      if (await submit("/api/admin/settings", f, "PUT")) { toast("success", "Settings saved"); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Platform commission (%)" name="commissionPercent" type="number" step="0.1" min={0} max={50} defaultValue={commissionPercent} error={fields.commissionPercent} hint="Applied to new orders only. Existing orders keep their rate." />
        <Input label="Buyer protection window (days)" name="autoCompleteDays" type="number" min={1} max={30} defaultValue={autoCompleteDays} error={fields.autoCompleteDays} hint="Delivered items auto-complete after this many days." />
      </div>
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Save</button>
    </form>
  );
}

export function BannerForm() {
  const { pending, error, fields, submit } = useApiForm();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const toast = useToast();
  const router = useRouter();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = Object.fromEntries(new FormData(form));
      if (await submit("/api/admin/banners", { ...f, imageUrl: media[0]?.url ?? "", isActive: true })) { toast("success", "Banner created"); form.reset(); setMedia([]); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" name="title" required error={fields.title} />
        <Input label="Badge" name="badge" error={fields.badge} placeholder="New arrival" />
        <Input label="Subtitle" name="subtitle" error={fields.subtitle} className="sm:col-span-2" />
        <Input label="Button label" name="ctaLabel" required defaultValue="Shop Now" error={fields.ctaLabel} />
        <Input label="Button link" name="ctaHref" required defaultValue="/marketplace" error={fields.ctaHref} />
        <Input label="Sort order" name="sortOrder" type="number" defaultValue={0} error={fields.sortOrder} />
      </div>
      <MediaUploader value={media.filter((m) => m.type === "IMAGE").slice(0, 1)} onChange={(v) => setMedia(v.filter((m) => m.type === "IMAGE").slice(-1))} error={fields.imageUrl} />
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Create banner</button>
    </form>
  );
}
