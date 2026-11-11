import Link from "next/link";
import { Logo } from "@hkfinhub/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skyline } from "@/components/skyline";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <header className="relative z-10 flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="HK FinHub home"><Logo /></Link>
        <ThemeToggle />
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-[var(--skyline)] opacity-50">
        <Skyline className="h-[200px] w-full" />
      </div>
      <main id="main" className="relative z-10 flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
