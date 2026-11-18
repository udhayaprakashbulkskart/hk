import { getAutoCompleteDays, getCommissionBps } from "@/lib/settings";
import { CommissionForm } from "@/components/admin/admin-forms";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Commission" };

export default async function AdminSettings() {
  const [bps, days] = await Promise.all([getCommissionBps(), getAutoCompleteDays()]);
  return (
    <div className="max-w-2xl">
      <PageTitle title="Commission & payouts" subtitle="Changes are recorded in the audit log." />
      <div className="card p-5"><CommissionForm commissionPercent={bps / 100} autoCompleteDays={days} /></div>
    </div>
  );
}
