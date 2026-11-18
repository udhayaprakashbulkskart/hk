"use client";
import { useState } from "react";
import { api } from "@/lib/client";

/** Shared submit state for API-backed forms: pending flag, form-level and field-level errors. */
export function useApiForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit<T>(url: string, body: unknown, method = "POST") {
    setPending(true);
    setError(null);
    setFields({});
    const r = await api<T>(url, { method, body });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      setFields(r.fields ?? {});
      return null;
    }
    return r.data;
  }
  return { pending, error, fields, submit, setError, setFields };
}
