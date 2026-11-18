import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PasswordForm, ProfileForm } from "@/components/forms/account-forms";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Account Settings" };

export default async function SettingsPage() {
  const user = await pageUser("/account/settings");
  const sessions = await db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle title="Account Settings" />
      <section className="card p-5"><h2 className="heading mb-4 text-lg">Profile</h2><ProfileForm d={user} /></section>
      <section className="card p-5">
        <h2 className="heading mb-1 text-lg">Security</h2>
        <p className="mb-4 text-sm text-muted">{sessions} active session{sessions === 1 ? "" : "s"}. Changing your password signs out all other devices.</p>
        <PasswordForm />
      </section>
    </div>
  );
}
