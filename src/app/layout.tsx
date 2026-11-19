import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { Spotlight } from "@/components/fx/spotlight";
import { BattleBackdrop } from "@/components/fx/battle-backdrop";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-cinzel" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN" },
  title: { default: `${SITE_NAME} — PUBG Mobile & BGMI Marketplace`, template: `%s · ${SITE_NAME}` },
  description: "Buy and sell officially transferable PUBG Mobile & BGMI skins, outfits and UC top-ups. Verified sellers, secure Razorpay payments.",
};

export const viewport: Viewport = { themeColor: "#1c0507", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="antialiased">
        <BattleBackdrop />
        <Spotlight />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
