# @hkfinhub/integration-razorpay

Razorpay collections (INR, UPI and cards) as orders. Verifies `X-Razorpay-Signature` (HMAC-SHA256, hex, of the raw body with the webhook secret) and requires `X-Razorpay-Event-Id`.

**Not yet validated against a live sandbox.** Request shapes follow Razorpay's public API, and signature behaviour is pinned by regression vectors in `apps/api/test/webhook-vectors.test.ts`. Both must be confirmed in a sandbox account before live use (decision D7).
