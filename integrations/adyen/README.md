# @hkfinhub/integration-adyen

Adyen collections through Sessions. Verifies each notification item's `additionalData.hmacSignature` (base64 HMAC-SHA256, with Adyen's escaping of `\` and `:` in the signing string, keyed with the hex HMAC key).

Status lookup is not implemented, so Adyen cannot move money yet: `fetchStatus` refuses, and nothing is posted from a notification alone. Adyen stays disabled until the lookup is built and test-tested.
