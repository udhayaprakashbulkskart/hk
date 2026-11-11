# @hkfinhub/integration-stripe

Stripe card collections through PaymentIntents. Verifies `Stripe-Signature` (`t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`) with a five-minute tolerance, and accepts any matching `v1` value so keys can rotate. Status is read from the PaymentIntent, including `latest_charge.amount_refunded` for refunds.

The client secret is returned to the customer app only and is never stored.
