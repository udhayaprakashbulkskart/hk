import type { Metadata, Viewport } from "next";
import { Inter, Teko } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { Spotlight } from "@/components/fx/spotlight";
import { TacticalBackdrop } from "@/components/fx/tactical-backdrop";
import { SITE_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const teko = Teko({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-teko" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — PUBG Mobile & BGMI Marketplace`, template: `%s · ${SITE_NAME}` },
  description: "Buy and sell officially transferable PUBG Mobile & BGMI skins, outfits and UC top-ups. Verified sellers, secure Razorpay payments.",
};

export const viewport: Viewport = { themeColor: "#0b0d10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${teko.variable}`}>
      <body className="antialiased">
        <TacticalBackdrop />
        <Spotlight />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
