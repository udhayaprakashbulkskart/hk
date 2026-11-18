"use client";
import { useRouter } from "next/navigation";
import { FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiForm } from "./use-api-form";

export function ProfileForm({ d }: { d: { name: string; phone: string | null; gamePlayerId: string | null; preferredGame: string } }) {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  const router = useRouter();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      if (await submit("/api/account/profile", f, "PATCH")) { toast("success", "Profile saved"); router.refresh(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" name="name" required defaultValue={d.name} error={fields.name} />
        <Input label="Mobile number" name="phone" inputMode="tel" defaultValue={d.phone ?? ""} error={fields.phone} />
        <Input label="Default Player ID" name="gamePlayerId" inputMode="numeric" defaultValue={d.gamePlayerId ?? ""} error={fields.gamePlayerId} hint="Pre-fills checkout. Never share your password or OTP." />
        <Select label="Preferred game" name="preferredGame" defaultValue={d.preferredGame} options={[{ value: "BGMI", label: "BGMI" }, { value: "PUBG_MOBILE", label: "PUBG Mobile" }, { value: "BOTH", label: "Both" }]} />
      </div>
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Save changes</button>
    </form>
  );
}

export function PasswordForm() {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = Object.fromEntries(new FormData(form));
      if (await submit("/api/account/password", f)) { toast("success", "Password changed. Other devices were signed out."); form.reset(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" required error={fields.currentPassword} />
        <Input label="New password" name="newPassword" type="password" autoComplete="new-password" required error={fields.newPassword} hint="8+ characters with a letter and a number" />
      </div>
      <button className="btn-outline" disabled={pending}>{pending && <Spinner />} Change password</button>
    </form>
  );
}

export function SupportForm({ email, orderRef }: { email?: string; orderRef?: string }) {
  const { pending, error, fields, submit } = useApiForm();
  const toast = useToast();
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = Object.fromEntries(new FormData(form));
      if (await submit("/api/support", { ...f, orderRef: f.orderRef || undefined })) { toast("success", "Ticket submitted — we'll reply by email and notification"); form.reset(); }
    }}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" required defaultValue={email} error={fields.email} />
        <Input label="Order number (optional)" name="orderRef" defaultValue={orderRef} error={fields.orderRef} placeholder="PS-20261118-ABC123" />
      </div>
      <Input label="Subject" name="subject" required error={fields.subject} />
      <Textarea label="Message" name="message" required error={fields.message} placeholder="Tell us what happened. Never include passwords or OTPs." />
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Send to support</button>
    </form>
  );
}
