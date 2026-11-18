"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string>; status: number };

/** Typed fetch wrapper for our JSON API. Never throws for HTTP errors. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error ?? `Request failed (${res.status})`, fields: json?.fields, status: res.status };
    }
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, error: "Network error — check your connection and try again.", status: 0 };
  }
}
