/** FAQ shared by /faq and /support. Keep answers factual: no delivery-time or transfer guarantees. */
export const FAQ: { group: string; items: [string, string][] }[] = [
  {
    group: "Safety",
    items: [
      ["Do you need my game password or OTP?", "Never. We only need your in-game Player ID (and nickname for UC). Anyone asking for your password or OTP is a scammer — report them to us."],
      ["Is ZYNOFLIX STORE official?", "No. ZYNOFLIX STORE is an independent marketplace and is not affiliated with, endorsed by or sponsored by KRAFTON, PUBG Corporation, Tencent or Level Infinite."],
      ["Can I buy or sell game accounts?", "No. Account trading breaks the games' terms of service and is not allowed here."],
    ],
  },
  {
    group: "Orders & delivery",
    items: [
      ["How is my item delivered?", "Sellers deliver only through methods the game itself allows — such as official in-game gifting or officially issued redeem codes — to the Player ID you enter at checkout. Whether a specific item can be gifted depends on the game's current rules."],
      ["How long does delivery take?", "It depends on the seller and the game's gifting rules. Each order shows its live status in My Orders, and you'll get a notification when the seller marks it delivered."],
      ["How do UC top-ups work?", "Pick your game and package, enter your Player ID and nickname, and pay. Our team fulfils the top-up after the payment is confirmed on our server; you can follow progress in My Orders."],
      ["What if I don't receive my item?", "Open the order and request a refund before confirming receipt. Our team reviews every request; approved refunds go to your wallet or original payment method."],
    ],
  },
  {
    group: "Payments & coupons",
    items: [
      ["Which payment methods do you accept?", "UPI, cards and netbanking through Razorpay (when enabled), plus your ZYNOFLIX wallet balance. An order is marked paid only after the payment is verified on our server."],
      ["How do coupons work?", "Enter a code at checkout and tap Apply. Each coupon has its own minimum order, expiry and per-customer limit, shown when you apply it. One coupon per order."],
      ["When does the seller get paid?", "Funds are held in escrow. The seller is paid after you confirm receipt, or automatically after the protection window if you don't raise an issue."],
    ],
  },
];
