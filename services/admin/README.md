# @hkfinhub/admin

Staff permissions and the controls behind the admin API.

- **Permission matrix** (`src/permissions.ts`): four roles, each with an explicit list of permissions. Checked on the
  server for every admin endpoint. A denial is audited before the error is returned.
- **Maker-checker**: provider approvals (which the live-payment gate reads) need a different super admin to approve.
  Limit changes and balance adjustments reuse the compliance and ledger workflows, which enforce the same rule.
- **PII reveals**: one identity field at a time, with a reason code. The audit row is written before the value is decrypted.
- **Staff roles** can be set only by a super admin, and only for a user whose two-factor is confirmed.

Domain services keep their own role checks as a second layer (for example, compliance decisions need COMPLIANCE_ADMIN).
The API-level guard (`apps/api/src/admin/staff.guard.ts`) adds the session, an active staff record, two-factor, and
the optional IP allow-list (required in production).
