import { Badge, Card, CardContent, CardHeader, CardTitle, Stat } from "@hkfinhub/ui";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";

const KYC_LABEL = { not_started: "Not started", documents_pending: "Documents needed", under_review: "Under review", verified: "Verified", rejected: "Not approved", additional_info_required: "More information needed" } as const;
const KYC_TONE = { not_started: "neutral", documents_pending: "gold", under_review: "gold", verified: "success", rejected: "danger", additional_info_required: "gold" } as const;

export default async function ProfilePage() {
  const dash = await api.getDashboard();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Profile" description="Your details and verification status." />
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-[var(--gold)] bg-[var(--secondary)] text-2xl font-semibold text-[var(--gold)]" aria-hidden="true">SC</div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">Sample Customer</p>
            <p className="text-sm text-[var(--muted-foreground)]">Customer ID HKF-•••• 0001 · Sandbox</p>
          </div>
          <Badge tone={KYC_TONE[dash.kyc]}>{KYC_LABEL[dash.kyc]}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Country" value="Hong Kong" />
            <Stat label="Language" value="English" />
            <Stat label="Base currency" value={dash.baseCurrency} />
            <Stat label="Time zone" value="Asia/Hong_Kong" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Email</span><Badge tone="success">Verified</Badge></div>
            <div className="flex items-center justify-between"><span>Mobile</span><Badge tone="success">Verified</Badge></div>
            <div className="flex items-center justify-between"><span>Identity</span><Badge tone={KYC_TONE[dash.kyc]}>{KYC_LABEL[dash.kyc]}</Badge></div>
          </CardContent>
        </Card>
      </div>

      <Section title="Linked payment accounts">
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {dash.accounts.filter((a) => a.kind !== "demat").map((a) => (
            <li key={a.id} className="flex items-center justify-between p-4 text-sm"><span>{a.name}</span><span className="font-mono text-[var(--muted-foreground)]">{a.reference}</span></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
