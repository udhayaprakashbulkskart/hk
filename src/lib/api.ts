import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./errors";

type Ctx<P> = { params: Promise<P> };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(status: number, error: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, fields }, { status });
}

/** Rejects cross-site state-changing requests (defence-in-depth on top of SameSite=Lax cookies). */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Invalid origin");
  }
  if (originHost !== host) throw new ApiError(403, "Cross-site request blocked");
}

export function zodFields(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Wraps a route handler with origin checks and uniform error responses. */
export function handler<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      checkOrigin(req);
      return await fn(req, (await ctx?.params) ?? ({} as P));
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message, err.fields);
      if (err instanceof ZodError) return fail(422, "Please fix the highlighted fields", zodFields(err));
      console.error("[api] unhandled error", err);
      return fail(500, "Something went wrong. Please try again.");
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(json);
}
