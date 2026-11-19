"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormError, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useApiForm } from "./use-api-form";

function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function PasswordInput({ error, autoComplete, hint }: { error?: string; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input label="Password" name="password" type={show ? "text" : "password"} required autoComplete={autoComplete} error={error} hint={hint} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-[34px] right-3 text-zinc-500 hover:text-white">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ok = await submit("/api/auth/login", { email: f.get("email"), password: f.get("password") });
        if (ok) {
          router.push(safeNext(next));
          router.refresh();
        }
      }}
    >
      <FormError message={error} />
      <Input label="Email" name="email" type="email" required autoComplete="email" error={fields.email} />
      <PasswordInput autoComplete="current-password" error={fields.password} />
      <button className="btn-primary w-full py-3" disabled={pending}>
        {pending && <Spinner />} Sign in
      </button>
      <p className="text-center text-sm text-muted">
        New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-neon hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { pending, error, fields, submit } = useApiForm();
  const router = useRouter();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ok = await submit("/api/auth/register", {
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          acceptTerms: f.get("acceptTerms") === "on",
        });
        if (ok) {
          router.push(safeNext(next));
          router.refresh();
        }
      }}
    >
      <FormError message={error} />
      <Input label="Full name" name="name" required autoComplete="name" error={fields.name} />
      <Input label="Email" name="email" type="email" required autoComplete="email" error={fields.email} />
      <PasswordInput autoComplete="new-password" error={fields.password} hint="At least 8 characters with a letter and a number" />
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" name="acceptTerms" className="mt-1 accent-[#f2c14e]" />
        <span>
          I agree to the <Link href="/terms" className="text-neon hover:underline">terms</Link> and understand ZYNOFLIX STORE will never ask for my game password or OTP.
        </span>
      </label>
      {fields.acceptTerms && <p className="-mt-2 text-xs text-neon-soft">{fields.acceptTerms}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>
        {pending && <Spinner />} Create account
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-neon hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
