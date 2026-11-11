import { PageHeader } from "@/components/page";
import { SendWizard } from "@/components/send-wizard";
import { api } from "@/lib/api";

export default async function SendPage() {
  const beneficiaries = await api.listBeneficiaries();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Payments" title="Send money" description="Pay a saved recipient or add a new one. Your balance changes only after our payment partner confirms the transfer." />
      <SendWizard beneficiaries={beneficiaries} />
    </div>
  );
}
