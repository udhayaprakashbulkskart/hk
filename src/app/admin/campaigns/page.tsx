import Image from "next/image";
import { db } from "@/lib/db";
import { RENDERS } from "@/lib/media";
import { ActionButton } from "@/components/forms/action-button";
import { CampaignForm } from "@/components/admin/admin-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Festival campaigns" };

const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export default async function AdminCampaigns() {
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  const live = campaigns.find((c) => c.isActive && (!c.endsAt || c.endsAt > now));
  return (
    <div className="space-y-6">
      <PageTitle title="Festival campaigns" subtitle="Drives the home page hero: title, artwork, call to action and countdown." />
      <ul className="grid gap-3 md:grid-cols-2">
        {campaigns.map((c) => {
          const expired = c.endsAt != null && c.endsAt < now;
          return (
            <li key={c.id} className={`card overflow-hidden ${live?.id === c.id ? "border-neon shadow-neon" : ""}`}>
              <div className="relative flex h-32 justify-between bg-[radial-gradient(circle_at_50%_0%,#9e1420,#2a070b_70%)] px-4">
                {[c.heroLeft, c.heroRight].map((u, i) => <div key={i} className="relative h-full w-24">{u && <Image src={u} alt="" fill sizes="96px" className="object-contain object-bottom" />}</div>)}
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>{c.nativeTitle && <p className="gold-text text-2xl font-black">{c.nativeTitle}</p>}<p className="heading gold-text text-xl">{c.title}</p></div>
                </div>
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-semibold">{c.name}</p>
                  {live?.id === c.id && <span className="badge border-neon bg-neon/20 text-neon">On home page</span>}
                  <StatusBadge status={expired ? "EXPIRED" : c.isActive ? "ACTIVE" : "ARCHIVED"} />
                </div>
                <p className="text-xs text-muted">{c.ctaLabel} → {c.ctaHref} · {c.endsAt ? `ends ${c.endsAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "no end date"}</p>
                <div className="flex gap-2">
                  <ActionButton url={`/api/admin/campaigns/${c.id}`} body={{ isActive: !c.isActive }} label={c.isActive ? "Pause" : "Activate"} success="Campaign updated" className="btn-sm" />
                  <ActionButton url={`/api/admin/campaigns/${c.id}`} method="DELETE" variant="danger" label="Delete" confirm="Delete this campaign?" success="Campaign deleted" className="btn-sm" />
                </div>
              </div>
            </li>
          );
        })}
        {!campaigns.length && <li className="card p-6 text-sm text-muted">No campaigns — the home page shows the default DROPZONE hero.</li>}
      </ul>
      <section className="card p-5">
        <h2 className="heading mb-4 text-lg">New campaign</h2>
        <CampaignForm renders={Object.entries(RENDERS).map(([k, v]) => ({ value: v, label: label(k) }))} />
      </section>
    </div>
  );
}
