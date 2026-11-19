import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/forms/auth-forms";
import { AuthShell } from "@/components/ui/auth-shell";
import { RENDERS } from "@/lib/media";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell title="Join ZYNOFLIX STORE" subtitle="Buy officially transferable PUBG Mobile &amp; BGMI cosmetics safely." render={RENDERS.goldenSeraph}>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
