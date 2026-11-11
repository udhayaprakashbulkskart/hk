/** Calls the API. Tokens are passed in per call and never written to storage. */
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function api<T>(path: string, opts: { method?: "GET" | "POST" | "PUT"; token?: string | null; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method: opts.method ?? "GET", headers, cache: "no-store" };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(`${API_ORIGIN}/v1${path}`, init);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(res.status, j.error?.code ?? "ERROR", j.error?.message ?? "The request could not be completed.");
  }
  return (await res.json()) as T;
}

/** Fetches a binary response (identity documents). Returns an object URL the caller must revoke. */
export async function apiBlob(path: string, token: string): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(res.status, j.error?.code ?? "ERROR", j.error?.message ?? "The document could not be opened.");
  }
  return URL.createObjectURL(await res.blob());
}
