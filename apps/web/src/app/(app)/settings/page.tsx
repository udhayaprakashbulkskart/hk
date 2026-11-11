import { PageHeader, Section } from "@/components/page";
import { ThemeSettings, PreferenceToggles } from "@/components/settings-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferences" title="Settings" description="Appearance, language and notifications." />
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent><ThemeSettings /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Language and region</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><label htmlFor="lang" className="font-medium">Language</label><select id="lang" defaultValue="en" className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm"><option value="en">English</option><option value="zh-HK">繁體中文 (香港)</option><option value="zh-CN">简体中文</option></select></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="base" className="font-medium">Display currency</label><select id="base" defaultValue="HKD" className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm"><option>HKD</option><option>USD</option><option>INR</option><option>EUR</option><option>GBP</option><option>AED</option><option>SGD</option><option>CNY</option></select></div>
        </CardContent>
      </Card>
      <Section title="Notifications">
        <Card><CardContent className="p-5"><PreferenceToggles /></CardContent></Card>
      </Section>
    </div>
  );
}
