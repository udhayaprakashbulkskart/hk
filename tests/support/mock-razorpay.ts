import { createServer, type Server } from "node:http";

/**
 * In-memory stand-in for the Razorpay REST API, used only by integration tests.
 * The app talks to it through RAZORPAY_API_BASE; tests control what each payment looks like.
 */
export type MockPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string };

export class MockRazorpay {
  orders = new Map<string, { id: string; amount: number; currency: string; receipt: string }>();
  payments = new Map<string, MockPayment>();
  refunds: { id: string; payment_id: string; amount: number }[] = [];
  private server?: Server;
  private n = 0;

  start(port = 4010) {
    this.server = createServer(async (req, res) => {
      const auth = req.headers.authorization ?? "";
      const send = (code: number, body: unknown) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (!auth.startsWith("Basic ")) return send(401, { error: { description: "auth required" } });
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const url = req.url ?? "";
      if (req.method === "POST" && url === "/orders") {
        const o = { id: `order_mock_${++this.n}`, amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" };
        this.orders.set(o.id, o);
        return send(200, o);
      }
      let m = url.match(/^\/payments\/([^/]+)$/);
      if (req.method === "GET" && m) {
        const p = this.payments.get(decodeURIComponent(m[1]));
        return p ? send(200, p) : send(400, { error: { description: "The id provided does not exist" } });
      }
      m = url.match(/^\/payments\/([^/]+)\/capture$/);
      if (req.method === "POST" && m) {
        const p = this.payments.get(decodeURIComponent(m[1]));
        if (!p) return send(400, { error: { description: "no payment" } });
        p.status = "captured";
        return send(200, p);
      }
      m = url.match(/^\/payments\/([^/]+)\/refund$/);
      if (req.method === "POST" && m) {
        const r = { id: `rfnd_mock_${++this.n}`, payment_id: decodeURIComponent(m[1]), amount: body.amount, status: "processed" };
        this.refunds.push(r);
        return send(200, r);
      }
      send(404, { error: { description: "not found" } });
    });
    return new Promise<void>((r) => this.server!.listen(port, r));
  }
  stop() {
    return new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r()));
  }
  /** Simulates the buyer paying in Razorpay Checkout. */
  pay(orderId: string, status = "captured", amountOverride?: number) {
    const o = this.orders.get(orderId)!;
    const p = { id: `pay_mock_${++this.n}`, order_id: orderId, amount: amountOverride ?? o.amount, currency: "INR", status, method: "upi" };
    this.payments.set(p.id, p);
    return p;
  }
}
