import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ListingForm } from "@/components/forms/listing-form";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Sell Your Item" };

export default async function NewListingPage() {
  const user = await pageUser("/sell/new");
  if (user.seller?.status !== "VERIFIED" && user.role !== "ADMIN") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="heading text-2xl">Verified sellers only</h1>
        <p className="mt-2 text-sm text-muted">Complete seller verification before listing items.</p>
        <Link href="/sell" className="btn-primary mt-5">Go to seller onboarding</Link>
      </div>
    );
  }
  const categories = await db.category.findMany({ where: { isSkin: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Sell Your Item" subtitle="List your PUBG / BGMI item. It goes live after a quick review." />
      <div className="card p-5 sm:p-6">
        <ListingForm categories={categories} />
      </div>
    </div>
  );
}
