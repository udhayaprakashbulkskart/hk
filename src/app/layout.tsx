import type { Metadata, Viewport } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-rajdhani" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — PUBG Mobile & BGMI Marketplace`, template: `%s · ${SITE_NAME}` },
  description: "Buy and sell officially transferable PUBG Mobile & BGMI skins, outfits and UC top-ups. Verified sellers, secure Razorpay payments.",
};

export const viewport: Viewport = { themeColor: "#090909", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
