import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pageAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await pageAdmin();
  const [products, sellers, refunds, withdrawals, reports, tickets] = await Promise.all([
    db.product.count({ where: { status: "PENDING" } }),
    db.sellerProfile.count({ where: { status: "PENDING" } }),
    db.refund.count({ where: { status: "REQUESTED" } }),
    db.withdrawal.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
  ]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <LogoMark className="size-8" />
          <span className="font-display text-lg font-bold tracking-wider">ADMIN <span className="text-neon">CONSOLE</span></span>
          <span className="ml-auto hidden text-sm text-muted sm:inline">{admin.email}</span>
          <Link href="/" className="btn-outline btn-sm"><ArrowLeft className="size-3.5" /> Store</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-5 lg:grid-cols-[230px_1fr] lg:px-6">
        <aside className="lg:sticky lg:top-20 lg:h-fit"><AdminNav counts={{ products, sellers, refunds, withdrawals, reports, tickets }} /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
