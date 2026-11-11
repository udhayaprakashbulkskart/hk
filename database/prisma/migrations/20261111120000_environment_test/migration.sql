-- The provider environment label "sandbox" is renamed to "test". Only the stored value changes.
-- No rows are created, removed or re-routed, and live routes remain disabled by their flags.
UPDATE "ProviderCapability" SET "environment" = 'test' WHERE "environment" = 'sandbox';
UPDATE "ProviderApproval"   SET "environment" = 'test' WHERE "environment" = 'sandbox';
UPDATE "Payment"            SET "environment" = 'test' WHERE "environment" = 'sandbox';
