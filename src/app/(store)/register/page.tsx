import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/forms/auth-forms";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="heading mt-3 text-3xl">Join PUBG Store</h1>
          <p className="text-sm text-muted">Buy and sell officially transferable cosmetics safely.</p>
        </div>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}
