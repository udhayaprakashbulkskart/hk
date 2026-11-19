import { db } from "@/lib/db";
import { ListingForm } from "@/components/forms/listing-form";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = await db.category.findMany({ where: { isSkin: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageTitle title="Add product" subtitle="Published products go live in the store immediately. Save as draft to finish later." />
      <div className="card p-5 sm:p-6">
        <ListingForm categories={categories} />
      </div>
    </div>
  );
}
