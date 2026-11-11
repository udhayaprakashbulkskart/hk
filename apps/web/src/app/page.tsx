import Link from "next/link";
import { ArrowRight, Globe2, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardContent, Logo } from "@hkfinhub/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skyline } from "@/components/skyline";
import { api } from "@/lib/api";

export default async function LandingPage() {
  const market = (await api.listMarket()).slice(0, 4);
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="HK FinHub home"><Logo /></Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium hover:bg-[var(--secondary)]">Log in</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Not a bank</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your Global <span className="text-[var(--primary)]">Wealth Hub</span>
          </h1>
          <p className="mt-4 text-base text-[var(--muted-foreground)] sm:text-lg">Banking · Trading · Investing · Global transfers</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 text-base font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">
              Sign in <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--gold)] px-6 text-base font-semibold text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--gold-foreground)]">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <div className="pointer-events-none absolute inset-x-0 top-[38%] -z-0 text-[var(--skyline)] opacity-70 sm:top-[30%]">
        <Skyline className="h-[320px] w-full sm:h-[420px]" />
      </div>

      <section className="relative mx-auto mt-12 max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Market overview">
          {market.map((q) => (
            <Card key={q.symbol} className="p-4">
              <CardContent className="p-0">
                <p className="text-xs text-[var(--muted-foreground)]">{q.symbol} · {q.name}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{q.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                <p className={q.changePct >= 0 ? "text-xs text-[var(--success)]" : "text-xs text-[var(--destructive)]"}>
                  {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}% · delayed
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Wallet, title: "Multi-currency accounts", body: "HKD, USD, INR, EUR, GBP, AED, SGD and CNY, with transparent fees and quoted rates." },
            { icon: Globe2, title: "Send and receive worldwide", body: "Domestic and international transfers through authorised payment partners." },
            { icon: TrendingUp, title: "Invest in global markets", body: "Hong Kong, US and India markets through licensed brokerage partners." },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="space-y-3 pt-6">
                <Icon className="size-6 text-[var(--gold)]" aria-hidden="true" />
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-[var(--muted-foreground)]">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--success)]" aria-hidden="true" />
          <p>
            HK FinHub is not a bank. Payments, FX, brokerage and custody are provided by authorised partners. Live money movement and trading are
            not yet enabled.
          </p>
        </div>
      </section>
    </div>
  );
}
