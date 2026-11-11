"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Label } from "@hkfinhub/ui";
import { authClient, messageFor } from "@/lib/auth";

const COUNTRIES = [
  ["HK", "Hong Kong", "+852"], ["IN", "India", "+91"], ["SG", "Singapore", "+65"], ["US", "United States", "+1"], ["GB", "United Kingdom", "+44"],
  ["AE", "United Arab Emirates", "+971"], ["CN", "China", "+86"], ["DE", "Germany", "+49"], ["FR", "France", "+33"], ["AU", "Australia", "+61"],
] as const;

const LANGUAGES = [["en", "English"], ["zh-HK", "繁體中文 (香港)"], ["zh-CN", "简体中文"], ["hi", "हिन्दी"]] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [country, setCountry] = useState<string>("HK");
  const [language, setLanguage] = useState<string>("en");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dial = COUNTRIES.find(([code]) => code === country)?.[2] ?? "+852";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get("name") ?? "").trim();
    const email = String(d.get("email") ?? "").trim();
    const phone = `${dial} ${String(d.get("phone") ?? "").trim()}`;
    const password = String(d.get("password") ?? "");
    const problems: string[] = [];
    if (name.length < 2) problems.push("Enter your full name as on your ID.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("Enter a valid email address.");
    if (String(d.get("phone") ?? "").replace(/\D/g, "").length < 6) problems.push("Enter a valid mobile number.");
    if (password.length < 12) problems.push("Password must be at least 12 characters.");
    if (!d.get("terms")) problems.push("Accept the terms to continue.");
    if (problems.length) return setError(problems.join(" "));

    setError(null);
    setBusy(true);
    try {
      await authClient.register({ email, phone, password, fullName: name, countryCode: country, language });
      // The API answers the same whether or not the email is new, so we always move on to verification.
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">Create your account</CardTitle>
        <CardDescription>We verify your email and mobile number before you can move money.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="name" label="Full name"><Input id="name" name="name" autoComplete="name" /></Field>
          <Field id="email" label="Email"><Input id="email" name="email" type="email" autoComplete="email" inputMode="email" /></Field>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex gap-2">
              <span className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm tabular-nums" aria-hidden="true">{dial}</span>
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="5555 0123" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country of residence</Label>
              <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language">Language</Label>
              <select id="language" name="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
          </div>
          <Field id="password" label="Password" hint="At least 12 characters. Not a common password.">
            <Input id="password" name="password" type="password" autoComplete="new-password" />
          </Field>
          <label className="flex items-start gap-3 text-sm text-[var(--muted-foreground)]">
            <input type="checkbox" name="terms" className="mt-1 size-4 accent-[var(--primary)]" />
            <span>I accept the terms of use and privacy notice, and understand that HK FinHub services are provided through authorised partners.</span>
          </label>
          {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>Continue</Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Already have an account? <Link href="/login" className="font-semibold text-[var(--gold)] hover:underline">Log in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
