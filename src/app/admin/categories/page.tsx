import Link from "next/link";
import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { CategoryForm } from "@/components/admin/admin-forms";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Categories" };

export default async function AdminCategories() {
  const cats = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div className="space-y-6">
      <PageTitle title="Categories" subtitle="Storefront categories. Each skin category gets a page at /category/<slug>." />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Order</th><th>Name</th><th>Slug</th><th>Type</th><th>Products</th><th /></tr></thead>
          <tbody>
            {cats.map((c, i) => (
              <tr key={c.id}>
                <td className="tabular-nums">{c.sortOrder}</td>
                <td className="font-semibold">{c.name}</td>
                <td>{c.isSkin ? <Link href={`/category/${c.slug}`} className="font-mono text-xs text-neon hover:underline">{c.slug}</Link> : <span className="font-mono text-xs">{c.slug}</span>}</td>
                <td className="text-xs">{c.isSkin ? "Cosmetics" : "UC / official"}</td>
                <td>{c._count.products}</td>
                <td className="whitespace-nowrap">
                  <div className="flex gap-2">
                    {i > 0 && <ActionButton url={`/api/admin/categories/${c.id}`} body={{ sortOrder: Math.max(0, cats[i - 1].sortOrder - 1) }} label="↑" success="Moved" className="btn-sm" />}
                    {i < cats.length - 1 && <ActionButton url={`/api/admin/categories/${c.id}`} body={{ sortOrder: cats[i + 1].sortOrder + 1 }} label="↓" success="Moved" className="btn-sm" />}
                    {c.isSkin && <ActionButton url={`/api/admin/categories/${c.id}`} method="DELETE" variant="danger" label="Delete" confirm={`Delete ${c.name}?`} success="Category deleted" className="btn-sm" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-5"><h2 className="heading mb-4 text-lg">New category</h2><CategoryForm /></section>
    </div>
  );
}
