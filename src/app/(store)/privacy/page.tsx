import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Privacy Policy", description: "How ZYNOFLIX STORE collects, uses and protects your data.", alternates: { canonical: "/privacy" } };

const SECTIONS: [string, string][] = [
  ["What we collect", "Account details you give us (name, email, optional phone), the in-game Player ID and nickname you enter for delivery, your orders, wallet activity, support messages and listings. We do not collect game passwords, OTPs or payment card numbers."],
  ["Payments", "Online payments are processed by Razorpay. We receive payment status and reference IDs to verify and reconcile your order; card and UPI details stay with the payment provider."],
  ["How we use it", "To run your account, process and deliver orders, prevent fraud and abuse (including rate limiting and audit logs), handle refunds and support, and send order notifications. We don't sell your personal data."],
  ["Sharing", "Our fulfilment team sees the Player ID, nickname and game needed to deliver your order. We share data with service providers that host the site, store media and process payments, and with authorities where the law requires."],
  ["Cookies", "We use a single essential session cookie to keep you signed in. No advertising cookies."],
  ["Retention", "Order and payment records are kept as long as needed for accounting and dispute handling. You can delete your account from Settings; records we must keep by law are retained in restricted form."],
  ["Security", "Passwords are hashed, sessions are stored hashed on the server, and payment confirmations are verified server-side with the provider before an order is marked paid."],
  ["Your choices", "You can update your profile, change your password, and request account deletion in Settings, or contact us through the Contact page for any privacy request."],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Privacy Policy" subtitle="Last updated November 2026" />
      <div className="space-y-4">
        {SECTIONS.map(([h, b]) => (
          <section key={h} className="card p-5">
            <h2 className="heading mb-1.5 text-lg text-neon">{h}</h2>
            <p className="text-sm leading-relaxed text-[#f3dcb8]">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
