import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/ui/auth-shell";
import { RENDERS } from "@/lib/media";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to buy, sell and track orders." render={RENDERS.crimsonGambler}>
      <LoginForm next={next} />
    </AuthShell>
  );
}
