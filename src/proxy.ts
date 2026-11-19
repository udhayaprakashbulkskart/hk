import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, optimistic gate: bounce visitors without a session cookie away from private pages.
 * Real authorisation (session validity, roles) happens server-side in every page and API route.
 */
const PRIVATE = ["/admin", "/account", "/orders", "/wallet", "/cart", "/checkout"];

/** Selling is closed (admins list every product). Old seller URLs get a permanent redirect. */
const RETIRED: [string, string][] = [
  ["/account/sales", "/admin/fulfilment"],
  ["/sell", "/marketplace"],
  ["/seller", "/marketplace"],
];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const under = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const retired = RETIRED.find(([p]) => under(p));
  if (retired) return NextResponse.redirect(new URL(retired[1], req.url), 308);
  if (PRIVATE.some(under) && !req.cookies.get("ps_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/orders/:path*", "/wallet/:path*", "/cart", "/checkout", "/sell", "/sell/:path*", "/seller/:path*"],
};
