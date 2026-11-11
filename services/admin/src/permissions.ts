/**
 * Staff permission matrix. Enforced on the server for every admin endpoint. Domain services keep their own
 * role checks as a second layer (for example, compliance decisions still require COMPLIANCE_ADMIN).
 */
export const ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN"] as const;
export type StaffRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "customers.read",
  "customers.pii.reveal",
  "kyc.read",
  "kyc.decide",
  "kyc.document.read",
  "compliance.read",
  "compliance.clear",
  "limits.request",
  "limits.approve",
  "adjustments.request",
  "adjustments.approve",
  "payments.read",
  "transfers.read",
  "finance.read",
  "provider.config.request",
  "provider.config.approve",
  "approvals.read",
  "settings.read",
  "audit.read",
  "staff.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  SUPER_ADMIN: ["customers.read", "provider.config.request", "provider.config.approve", "approvals.read", "audit.read", "staff.manage", "finance.read", "payments.read", "transfers.read", "settings.read"],
  FINANCE_ADMIN: ["customers.read", "finance.read", "payments.read", "transfers.read", "adjustments.request", "adjustments.approve", "approvals.read"],
  COMPLIANCE_ADMIN: ["customers.read", "customers.pii.reveal", "kyc.read", "kyc.decide", "kyc.document.read", "compliance.read", "compliance.clear", "limits.request", "limits.approve", "audit.read", "approvals.read"],
  SUPPORT_ADMIN: ["customers.read", "kyc.read", "payments.read", "transfers.read"],
};

export function isRole(value: string): value is StaffRole {
  return (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
