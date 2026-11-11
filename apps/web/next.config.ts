import type { NextConfig } from "next";

/** Origin of the customer API, allowed by connect-src. Set NEXT_PUBLIC_API_URL per environment. */
const apiOrigin = (() => {
  try {
    return new URL(process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000").origin;
  } catch {
    return "http://localhost:4000";
  }
})();

const nextConfig: NextConfig = {
  transpilePackages: [],
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
