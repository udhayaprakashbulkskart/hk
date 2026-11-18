import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { NeonBackdrop } from "@/components/fx/neon-backdrop";
import { Spotlight } from "@/components/fx/spotlight";
import { SITE_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const orbitron = Orbitron({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — PUBG Mobile & BGMI Marketplace`, template: `%s · ${SITE_NAME}` },
  description: "Buy and sell officially transferable PUBG Mobile & BGMI skins, outfits and UC top-ups. Verified sellers, secure Razorpay payments.",
};

export const viewport: Viewport = { themeColor: "#05060b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable}`}>
      <body className="antialiased">
        <NeonBackdrop />
        <Spotlight />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
