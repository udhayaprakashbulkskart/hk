import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, optimistic gate: bounce visitors without a session cookie away from private pages.
 * Real authorisation (session validity, roles) happens server-side in every page and API route.
 */
const PRIVATE = ["/admin", "/account", "/orders", "/wallet", "/cart", "/checkout", "/sell/new", "/sell/listings"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(p + "/")) && !req.cookies.get("ps_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/orders/:path*", "/wallet/:path*", "/cart", "/checkout", "/sell/new", "/sell/listings/:path*"],
};
