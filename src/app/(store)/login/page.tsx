import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms/auth-forms";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="heading mt-3 text-3xl">Welcome back</h1>
          <p className="text-sm text-muted">Sign in to buy, sell and track orders.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
