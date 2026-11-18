import Image from "next/image";
import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { BannerForm } from "@/components/admin/admin-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Banners" };

export default async function AdminBanners() {
  const banners = await db.banner.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-6">
      <PageTitle title="Promotional banners" subtitle="Shown in the home page carousel (active banners, by sort order)." />
      <ul className="grid gap-3 md:grid-cols-2">
        {banners.map((b) => (
          <li key={b.id} className="card overflow-hidden">
            <div className="relative h-32 bg-black"><Image src={b.imageUrl} alt="" fill sizes="50vw" className="object-cover" unoptimized={b.imageUrl.endsWith(".svg") || b.imageUrl.startsWith("/uploads/")} /></div>
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-2"><p className="flex-1 font-semibold">{b.title}</p><StatusBadge status={b.isActive ? "ACTIVE" : "ARCHIVED"} /></div>
              <p className="text-xs text-muted">{b.subtitle} · {b.ctaLabel} → {b.ctaHref} · order {b.sortOrder}</p>
              <div className="flex gap-2">
                <ActionButton url={`/api/admin/banners/${b.id}`} body={{ isActive: !b.isActive }} label={b.isActive ? "Deactivate" : "Activate"} success="Banner updated" />
                <ActionButton url={`/api/admin/banners/${b.id}`} method="DELETE" variant="danger" label="Delete" confirm="Delete this banner?" success="Banner deleted" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <section className="card p-5"><h2 className="heading mb-4 text-lg">New banner</h2><BannerForm /></section>
    </div>
  );
}
