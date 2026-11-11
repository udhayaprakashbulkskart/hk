# admin

Internal staff console (Next.js). Built on the admin API under `/v1/admin/*`. Serve only on a private network.

What it does:
- Staff sign-in with password and authenticator code. The access token is kept in memory only.
- Sections appear only for the permissions the signed-in role holds. The server still checks every request.
- Pending approvals (approve or reject each request on its own endpoint), open compliance cases with clearance notes,
  identity status and decisions, audited document viewing, logged field reveals, and recent audit entries.

Not included: customer-facing screens, payment or investment operations views, and staff management (use the API).
