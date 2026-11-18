"use client";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

let loader: Promise<boolean> | null = null;
export function loadRazorpay() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  loader ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => {
      loader = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return loader;
}

export type RzpSuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

/** Opens Razorpay Checkout. Resolves with the gateway response, or null if the buyer closed it. */
export async function openRazorpay(opts: { keyId: string; razorpayOrderId: string; amount: number; currency: string; description: string; prefill?: { name?: string; email?: string; contact?: string } }) {
  if (!(await loadRazorpay()) || !window.Razorpay) throw new Error("Couldn't load the payment window. Check your connection.");
  return new Promise<RzpSuccess | { failed: string } | null>((resolve) => {
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      order_id: opts.razorpayOrderId,
      amount: opts.amount,
      currency: opts.currency,
      name: "PUBG Store",
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#2EF5C6" },
      handler: (r: RzpSuccess) => resolve(r),
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    rzp.on("payment.failed", (r) => resolve({ failed: (r as { error?: { description?: string } })?.error?.description ?? "Payment failed" }));
    rzp.open();
  });
}
