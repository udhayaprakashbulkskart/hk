import { PageHeader } from "@/components/page";
import { ManualBalanceCard } from "@/components/manual-balance-card";

/** Dashboard shows the owner's balance only. */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Your Global Wealth Hub" title="Dashboard" description="Your balance." />
      <div className="grid gap-4 md:grid-cols-2">
        <ManualBalanceCard />
      </div>
    </div>
  );
}
