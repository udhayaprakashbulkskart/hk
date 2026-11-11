import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "HK FinHub Admin", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
