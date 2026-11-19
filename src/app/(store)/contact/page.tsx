import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, Mail, ShieldAlert, Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SupportForm } from "@/components/forms/account-forms";
import { PageTitle } from "@/components/ui/section";
import { Frame } from "@/components/ui/frame";

export const metadata: Metadata = { title: "Contact Us", description: "Message the DROPZONE STORE support team about orders, payments, UC top-ups or selling.", alternates: { canonical: "/contact" } };

export default async function ContactPage(props: PageProps<"/contact">) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  return (
    <div>
      <PageTitle title="Contact us" subtitle="Our team replies by email and in your notifications. For order issues, include the order number." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Frame>
          <div className="p-5 sm:p-6">
            <SupportForm email={user?.email} orderRef={typeof sp.order === "string" ? sp.order : undefined} />
          </div>
        </Frame>
        <aside className="space-y-3">
          <div className="card flex gap-3 p-4 text-sm"><Ticket className="size-5 shrink-0 text-neon" /><p>Messages become support tickets. Signed-in customers can see replies on the <Link href="/support" className="text-neon hover:underline">Support page</Link>.</p></div>
          <div className="card flex gap-3 p-4 text-sm"><HelpCircle className="size-5 shrink-0 text-neon" /><p>Quick answers about delivery, UC and coupons are in the <Link href="/faq" className="text-neon hover:underline">FAQ</Link>.</p></div>
          <div className="card flex gap-3 p-4 text-sm"><Mail className="size-5 shrink-0 text-neon" /><p>Refund or delivery problem? Open the order in <Link href="/orders" className="text-neon hover:underline">My Orders</Link> and use “Request refund” — it&apos;s the fastest route.</p></div>
          <div className="card flex gap-3 border-mint/50 p-4 text-sm"><ShieldAlert className="size-5 shrink-0 text-mint" /><p>We will never ask for your game password, OTP or payment PIN. Don&apos;t include them in messages.</p></div>
        </aside>
      </div>
    </div>
  );
}
