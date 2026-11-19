"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError, Input, Select } from "@/components/ui/field";
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

/** FormData → JSON: drops empty strings and converts datetime-local values to ISO (browser time zone). */
function clean(form: HTMLFormElement) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of new FormData(form)) {
    if (typeof v !== "string" || v.trim() === "") continue;
    const el = form.elements.namedItem(k);
    out[k] = el instanceof HTMLInputElement && el.type === "datetime-local" ? new Date(v).toISOString() : v;
  }
  return out;
}

export function CouponForm() {
  const { pending, error, fields, submit } = useApiForm();
  const [type, setType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const toast = useToast();
  const router = useRouter();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (await submit("/api/admin/coupons", { ...clean(form), type, isActive: true })) { toast("success", "Coupon created"); form.reset(); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Code" name="code" required error={fields.code} placeholder="LUNAR10" className="uppercase" />
        <Select label="Type" name="type" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FLAT")} options={[{ value: "PERCENT", label: "Percent off" }, { value: "FLAT", label: "Flat ₹ off" }]} />
        <Input label={type === "PERCENT" ? "Percent (1–90)" : "Amount (₹)"} name="value" type="number" min={1} required error={fields.value} />
        <Input label="Description" name="description" error={fields.description} className="sm:col-span-3" placeholder="10% off festival orders" />
        <Input label="Minimum order (₹)" name="minOrder" type="number" min={0} defaultValue={0} error={fields.minOrder} />
        {type === "PERCENT" && <Input label="Max discount (₹, optional)" name="maxDiscount" type="number" min={1} error={fields.maxDiscount} />}
        <Input label="Total uses (optional)" name="usageLimit" type="number" min={1} error={fields.usageLimit} />
        <Input label="Uses per customer" name="perUserLimit" type="number" min={1} defaultValue={1} error={fields.perUserLimit} />
        <Input label="Expires (optional)" name="endsAt" type="datetime-local" error={fields.endsAt} />
      </div>
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Create coupon</button>
    </form>
  );
}

export function CategoryForm() {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  const router = useRouter();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (await submit("/api/admin/categories", { ...clean(form), isSkin: true })) { toast("success", "Category created"); form.reset(); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Name" name="name" required error={fields.name} placeholder="Parachutes" />
        <Input label="Slug" name="slug" required error={fields.slug} placeholder="parachutes" hint="Used in /category/<slug>" />
        <Input label="Sort order" name="sortOrder" type="number" min={0} defaultValue={20} error={fields.sortOrder} />
        <Input label="Description" name="description" error={fields.description} className="sm:col-span-3" />
      </div>
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Add category</button>
    </form>
  );
}

export function CampaignForm({ renders }: { renders: { value: string; label: string }[] }) {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  const router = useRouter();
  const opts = [{ value: "", label: "Default render" }, ...renders];
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (await submit("/api/admin/campaigns", { ...clean(form), isActive: true })) { toast("success", "Campaign created"); form.reset(); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Internal name" name="name" required error={fields.name} placeholder="Lunar Festival 2027" />
        <Input label="Kicker" name="kicker" error={fields.kicker} placeholder="Limited-time festival event" />
        <Input label="Title" name="title" required error={fields.title} placeholder="Lunar Festival Sale" />
        <Input label="Decorative title (optional)" name="nativeTitle" error={fields.nativeTitle} placeholder="新春" />
        <Input label="Subtitle" name="subtitle" error={fields.subtitle} className="sm:col-span-2" />
        <Input label="Button label" name="ctaLabel" defaultValue="Shop Now" error={fields.ctaLabel} />
        <Input label="Button link" name="ctaHref" defaultValue="/category/bundles" error={fields.ctaHref} />
        <Select label="Left hero image" name="heroLeft" options={opts} error={fields.heroLeft} />
        <Select label="Right hero image" name="heroRight" options={opts} error={fields.heroRight} />
        <Input label="Ends at (shows countdown)" name="endsAt" type="datetime-local" error={fields.endsAt} />
      </div>
      <p className="text-xs text-muted">The newest active, unexpired campaign is shown as the home page hero.</p>
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Create campaign</button>
    </form>
  );
}
