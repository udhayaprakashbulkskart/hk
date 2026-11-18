"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/states";

/**
 * Calls a JSON API endpoint and refreshes server data on success.
 * `prompt` asks for a text value (e.g. a rejection reason) that is merged into the body under `promptKey`.
 */
export function ActionButton({
  url, method = "PATCH", body = {}, label, variant = "outline", confirm, prompt, promptKey = "reason", promptRequired = true, success = "Done", className,
}: {
  url: string; method?: string; body?: Record<string, unknown>; label: React.ReactNode; variant?: "primary" | "outline" | "ghost" | "danger";
  confirm?: string; prompt?: string; promptKey?: string; promptRequired?: boolean; success?: string; className?: string;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function run() {
    let extra: Record<string, unknown> = {};
    if (prompt) {
      const v = window.prompt(prompt);
      if (v === null) return;
      if (promptRequired && !v.trim()) return toast("error", "A value is required");
      extra = { [promptKey]: v.trim() || undefined };
    } else if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    const r = await api(url, { method, body: { ...body, ...extra } });
    setPending(false);
    if (!r.ok) return toast("error", r.error);
    toast("success", success);
    router.refresh();
  }
  const cls = { primary: "btn-primary", outline: "btn-outline", ghost: "btn-ghost", danger: "btn border border-neon/50 bg-neon/10 text-neon-soft hover:bg-neon/20" }[variant];
  return (
    <button type="button" onClick={run} disabled={pending} className={clsx(cls, "btn-sm", className)}>
      {pending && <Spinner className="size-3" />} {label}
    </button>
  );
}
