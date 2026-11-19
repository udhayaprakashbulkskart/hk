import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { Spotlight } from "@/components/fx/spotlight";
import { BattleBackdrop } from "@/components/fx/battle-backdrop";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN" },
  title: { default: `${SITE_NAME} — PUBG Mobile & BGMI Marketplace`, template: `%s · ${SITE_NAME}` },
  description: "Buy officially transferable PUBG Mobile & BGMI skins, outfits, bundles and UC top-ups. Secure Razorpay payments.",
};

export const viewport: Viewport = { themeColor: "#17191c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable}`}>
      <body className="antialiased">
        <BattleBackdrop />
        <Spotlight />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
