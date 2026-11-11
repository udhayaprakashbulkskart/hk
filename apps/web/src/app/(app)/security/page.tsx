import { KeyRound, Laptop, ShieldCheck, Smartphone } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hkfinhub/ui";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";

export default async function SecurityPage() {
  const devices = await api.listDevices();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account protection" title="Security" description="Two-factor authentication, passwords and the devices that can access your account." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-[var(--success)]" aria-hidden="true" />Two-factor authentication</CardTitle>
            <CardDescription>Required before any money moves.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><span className="text-sm">Authenticator app</span><Badge tone="success">On</Badge></div>
            <div className="flex items-center justify-between"><span className="text-sm">Recovery codes</span><span className="text-sm tabular-nums text-[var(--muted-foreground)]">8 of 10 unused</span></div>
            <Button variant="outline" className="w-full" disabled>Manage authenticator</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-[var(--gold)]" aria-hidden="true" />Password</CardTitle>
            <CardDescription>At least 12 characters. Checked against known breached passwords.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Change password</Button>
          </CardContent>
        </Card>
      </div>

      <Section title="Devices and sessions">
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {devices.map((d) => {
            const Icon = d.platform === "web" ? Laptop : Smartphone;
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-5 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name} {d.current ? <Badge tone="gold" className="ml-1">This device</Badge> : null}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{d.location} · {d.lastActive}</p>
                  </div>
                </div>
                {!d.current ? <Button variant="outline" size="sm" disabled>Sign out</Button> : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-[var(--muted-foreground)]">Device sign-out is available once live sessions are connected.</p>
      </Section>
    </div>
  );
}
