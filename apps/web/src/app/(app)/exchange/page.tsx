import { PageHeader } from "@/components/page";
import { ExchangeTool } from "@/components/quote-tools";
import { api } from "@/lib/api";

export default async function ExchangePage() {
  const history = await api.getFxHistory("HKD", "USD");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Multi-currency" title="Currency exchange" description="Compare rates, fees and the amount your recipient receives." />
      <ExchangeTool initialHistory={history} />
    </div>
  );
}
