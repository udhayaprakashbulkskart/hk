"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Tag } from "lucide-react";
import { FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { RARITY_LABEL } from "@/lib/constants";
import { useApiForm } from "./use-api-form";
import { MediaUploader, type MediaItem } from "./media-uploader";

export type ListingDefaults = {
  id?: string; title?: string; description?: string; categoryId?: string; game?: string; rarity?: string; level?: number | null; maxLevel?: number | null;
  features?: string[]; deliveryMethod?: string; price?: number; compareAtPrice?: number | null; stock?: number; media?: MediaItem[];
};

export function ListingForm({ categories, defaults = {} }: { categories: { id: string; name: string }[]; defaults?: ListingDefaults }) {
  const { pending, error, fields, submit } = useApiForm();
  const [media, setMedia] = useState<MediaItem[]>(defaults.media ?? []);
  const router = useRouter();
  const toast = useToast();
  const editing = !!defaults.id;

  async function save(form: HTMLFormElement, publish: boolean) {
    const f = new FormData(form);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const body = {
      title: f.get("title"), description: f.get("description"), categoryId: f.get("categoryId"), game: f.get("game"), rarity: f.get("rarity"),
      level: num("level"), maxLevel: num("maxLevel"),
      features: String(f.get("features") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      deliveryMethod: f.get("deliveryMethod"), price: f.get("price"), compareAtPrice: num("compareAtPrice"), stock: f.get("stock"),
      media, submit: publish, complianceAck: f.get("complianceAck") === "on",
    };
    const res = await submit<{ id: string; status: string }>(editing ? `/api/products/${defaults.id}` : "/api/products", body, editing ? "PATCH" : "POST");
    if (res) {
      toast("success", publish ? "Product published" : "Draft saved");
      router.push("/admin/products?status=APPROVED");
      router.refresh();
    } else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(e.currentTarget, true); }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Item type" name="categoryId" required defaultValue={defaults.categoryId} error={fields.categoryId} options={[{ value: "", label: "Select a category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Input label="Item name" name="title" required defaultValue={defaults.title} error={fields.title} placeholder="e.g. Glacier M416 (Lv.7)" />
        <Select label="Game / platform" name="game" defaultValue={defaults.game ?? "BOTH"} error={fields.game} options={[{ value: "BOTH", label: "PUBG Mobile & BGMI" }, { value: "BGMI", label: "BGMI only" }, { value: "PUBG_MOBILE", label: "PUBG Mobile only" }]} />
        <Select label="Rarity" name="rarity" defaultValue={defaults.rarity ?? "EPIC"} error={fields.rarity} options={Object.entries(RARITY_LABEL).map(([value, label]) => ({ value, label }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Level" name="level" type="number" min={1} max={10} defaultValue={defaults.level ?? ""} error={fields.level} hint="Upgradable guns" />
          <Input label="Max level" name="maxLevel" type="number" min={1} max={10} defaultValue={defaults.maxLevel ?? ""} error={fields.maxLevel} />
        </div>
        <Select label="Delivery method" name="deliveryMethod" defaultValue={defaults.deliveryMethod ?? "IN_GAME_GIFT"} error={fields.deliveryMethod} options={[{ value: "IN_GAME_GIFT", label: "Official in-game gift to Player ID" }, { value: "REDEEM_CODE", label: "Official redeem code" }]} />
      </div>
      <Textarea label="Description" name="description" required defaultValue={defaults.description} error={fields.description} placeholder="Describe the item, effects, and how you'll deliver it." maxLength={2000} />
      <Input label="Features (comma separated)" name="features" defaultValue={defaults.features?.join(", ")} error={fields.features} placeholder="Kill Effect, Loot Crate, Advanced Look" />
      <MediaUploader value={media} onChange={setMedia} error={fields.media ?? fields["media.0.url"]} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Price (₹)" name="price" type="number" min={10} required defaultValue={defaults.price ?? ""} error={fields.price} placeholder="Sale price" />
        <Input label="Original price (₹, optional)" name="compareAtPrice" type="number" min={10} defaultValue={defaults.compareAtPrice ?? ""} error={fields.compareAtPrice} hint="Shows a discount badge" />
        <Input label="Quantity available" name="stock" type="number" min={1} max={999} required defaultValue={defaults.stock ?? 1} error={fields.stock} />
      </div>
      <div className="card flex gap-3 border-warn/30 p-4 text-sm text-zinc-300">
        <ShieldAlert className="size-5 shrink-0 text-warn" />
        <label className="flex items-start gap-2">
          <input type="checkbox" name="complianceAck" className="mt-1 accent-[#f2c14e]" />
          <span>This item can be transferred using the game&apos;s official gifting or redeem system under its current terms. This is not a game account, and the buyer will never be asked for a password or OTP.</span>
        </label>
      </div>
      {fields.complianceAck && <p className="-mt-3 text-xs text-neon-soft">{fields.complianceAck}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="btn-primary flex-1 py-3" disabled={pending}>{pending ? <Spinner /> : <Tag className="size-4" />} {editing ? "Save & publish" : "Publish product"}</button>
        <button type="button" className="btn-outline py-3" disabled={pending} onClick={(e) => save(e.currentTarget.form!, false)}>Save as draft</button>
      </div>
    </form>
  );
}
