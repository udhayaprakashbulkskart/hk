import Link from "next/link";
import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Reported listings" };
const TABS = ["OPEN", "RESOLVED", "DISMISSED"] as const;

export default async function AdminReports(props: PageProps<"/admin/reports">) {
  const status = pick((await props.searchParams).status, TABS, "OPEN");
  const rows = await db.report.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100, include: { product: { select: { title: true, slug: true, status: true } }, reporter: { select: { email: true } } } });
  return (
    <div>
      <PageTitle title="Reported listings" subtitle="Review buyer reports. Taking a listing down rejects it and removes it from carts." />
      <StatusTabs base="/admin/reports" tabs={TABS} current={status} />
      {rows.length === 0 ? <EmptyState title="No reports" /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge border-neon/50 bg-neon/10 text-neon-soft">{r.reason}</span>
                <Link href={`/product/${r.product.slug}`} target="_blank" className="font-semibold hover:text-neon">{r.product.title}</Link>
                <StatusBadge status={r.product.status} />
                <span className="ml-auto text-xs text-muted">{r.reporter.email} · {r.createdAt.toLocaleDateString("en-IN")}</span>
              </div>
              {r.details && <p className="text-sm text-zinc-300">{r.details}</p>}
              {r.adminNote && <p className="text-xs text-muted">Note: {r.adminNote}</p>}
              {r.status === "OPEN" && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton url={`/api/admin/reports/${r.id}`} body={{ status: "RESOLVED", takeDown: true }} variant="danger" label="Take down listing" prompt="Internal note:" promptKey="note" promptRequired={false} success="Listing removed" />
                  <ActionButton url={`/api/admin/reports/${r.id}`} body={{ status: "RESOLVED" }} label="Resolve (keep live)" prompt="Internal note:" promptKey="note" promptRequired={false} success="Resolved" />
                  <ActionButton url={`/api/admin/reports/${r.id}`} body={{ status: "DISMISSED" }} variant="ghost" label="Dismiss" success="Dismissed" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
