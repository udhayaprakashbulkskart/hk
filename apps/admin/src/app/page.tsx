"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { api, apiBlob, ApiError } from "@/lib/api";

interface Me {
  userId: string;
  role: string;
  permissions: string[];
}
interface LoginResponse {
  status: "mfa_required" | "authenticated";
  mfaToken?: string;
  tokens?: { accessToken: string };
}
interface Approval {
  id: string;
  action: string;
  requestedBy: string;
  createdAt: string;
}
interface CaseRow {
  id: string;
  kind: string;
  severity: string;
  subjectType: string;
  subjectId: string;
  openedAt: string;
}
interface KycStatus {
  status: string;
  tier: string;
  missing: string[];
  documents: { id: string; kind: string; mimeType: string; scanStatus: string }[];
  identity: { pan: string | null; passport: string | null; nationality: string | null };
}

const device = { name: "Admin console", platform: "web" as const };
const REVEAL_REASONS = ["CUSTOMER_REQUEST", "FRAUD_INVESTIGATION", "REGULATORY_REQUEST", "DISPUTE_RESOLUTION"];

function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Try again.";
}

export default function AdminConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const can = (p: string) => me?.permissions.includes(p) ?? false;

  const loadMe = useCallback(async (t: string) => {
    const profile = await api<Me>("/admin/me", { token: t });
    setMe(profile);
    setToken(t);
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<LoginResponse>("/auth/login", { method: "POST", body: { email, password, device } });
      if (res.status === "mfa_required" && res.mfaToken) {
        setMfaToken(res.mfaToken);
        setStep("mfa");
        return;
      }
      if (res.tokens) await loadMe(res.tokens.accessToken);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<LoginResponse>("/auth/login/mfa", { method: "POST", body: { mfaToken, code, device } });
      if (res.tokens) await loadMe(res.tokens.accessToken);
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!token || !me) {
    return (
      <main>
        <h1>HK FinHub staff sign-in</h1>
        <section>
          {step === "login" ? (
            <form onSubmit={signIn}>
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit">Continue</button>
            </form>
          ) : (
            <form onSubmit={verifyCode}>
              <label htmlFor="code">Authenticator code</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <button type="submit">Sign in</button>
            </form>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <p className="muted">Staff access needs a staff role and confirmed two-factor. Sessions last only in this tab.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <h1>Staff console</h1>
      <p className="muted">Signed in as {me.role.replace(/_/g, " ").toLowerCase()}. Every action is checked by the server and audited.</p>
      <div className="grid">
        {can("approvals.read") && <Approvals token={token} can={can} />}
        {can("compliance.read") && <Cases token={token} canClear={can("compliance.clear")} />}
        {can("kyc.read") && <KycPanel token={token} canDecide={can("kyc.decide")} />}
        {can("kyc.document.read") && <DocumentPanel token={token} />}
        {can("customers.pii.reveal") && <RevealPanel token={token} />}
        {can("customers.read") && <ListPanel title="Customers" path="/admin/users?limit=50" token={token} columns={[["When", "createdAt", "date"], ["Customer", "customerNumber", "text"], ["Email", "emailMasked", "text"], ["Status", "status", "text"]]} />}
        {can("payments.read") && <ListPanel title="Payments (monitoring)" path="/admin/payments?limit=50" token={token} columns={[["When", "createdAt", "date"], ["Direction", "direction", "text"], ["Provider", "providerId", "text"], ["Status", "status", "text"], ["Amount (minor units)", "amountMinor", "text"], ["Currency", "currency", "text"]]} />}
        {can("transfers.read") && <ListPanel title="Transfers" path="/admin/transfers?limit=50" token={token} columns={[["When", "createdAt", "date"], ["Kind", "kind", "text"], ["Status", "status", "text"], ["Amount (minor units)", "sourceMinor", "text"], ["From", "sourceCurrency", "text"], ["To", "recipientCurrency", "text"]]} />}
        {can("audit.read") && <AuditPanel token={token} />}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function useAction() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setError(null);
    setMessage(null);
    try {
      const m = await fn();
      if (m) setMessage(m);
    } catch (e) {
      setError(errorText(e));
    }
  };
  return { message, error, run };
}

/** Approvals are decided on the endpoint that owns each action. The request type says which. */
function Approvals({ token, can }: { token: string; can: (p: string) => boolean }) {
  const [items, setItems] = useState<Approval[] | null>(null);
  const { message, error, run } = useAction();
  const load = () => run(async () => {
    setItems((await api<{ items: Approval[] }>("/admin/approvals", { token })).items);
  });
  const decide = (a: Approval, decision: "APPROVED" | "REJECTED") => run(async () => {
    const paths: Record<string, string> = {
      PROVIDER_CONFIG: `/admin/provider-approvals/${a.id}/decision`,
      LIMIT_CHANGE: `/admin/limits/changes/${a.id}/decision`,
    };
    if (a.action === "BALANCE_ADJUSTMENT") {
      if (decision !== "APPROVED") throw new ApiError(422, "INVALID_REQUEST", "Adjustments are only approved or left pending.");
      await api(`/admin/adjustments/${a.id}/approve`, { method: "POST", token });
    } else {
      const path = paths[a.action];
      if (!path) throw new ApiError(422, "INVALID_REQUEST", "Unknown request type.");
      await api(path, { method: "POST", token, body: { decision } });
    }
    await load();
    return `Recorded ${decision.toLowerCase()}.`;
  });
  return (
    <Panel title="Pending approvals">
      <button type="button" onClick={load}>Refresh</button>
      {items && items.length === 0 && <p className="muted">Nothing is waiting for a second person.</p>}
      {items && items.length > 0 && (
        <table>
          <thead><tr><th>Request</th><th>Type</th><th>Requested by</th><th /></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.id.slice(0, 8)}</td>
                <td>{a.action.replace(/_/g, " ").toLowerCase()}</td>
                <td>{a.requestedBy.slice(0, 8)}</td>
                <td>
                  {(can("approvals.read")) && (
                    <>
                      <button type="button" onClick={() => decide(a, "APPROVED")}>Approve</button>{" "}
                      <button type="button" onClick={() => decide(a, "REJECTED")}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && <p className="muted" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

function Cases({ token, canClear }: { token: string; canClear: boolean }) {
  const [items, setItems] = useState<CaseRow[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const { message, error, run } = useAction();
  const load = () => run(async () => {
    setItems((await api<{ items: CaseRow[] }>("/admin/compliance/cases", { token })).items);
  });
  const clear = (id: string) => run(async () => {
    await api(`/admin/compliance/cases/${id}/clear`, { method: "POST", token, body: { note: note[id] ?? "" } });
    await load();
    return "Case cleared with the note recorded.";
  });
  return (
    <Panel title="Open compliance cases">
      <button type="button" onClick={load}>Load cases</button>
      {items && items.length === 0 && <p className="muted">No open cases.</p>}
      {items?.map((c) => (
        <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
          <div>{c.kind} · {c.severity} · {c.subjectType.toLowerCase()} {c.subjectId.slice(0, 8)}</div>
          {canClear && (
            <>
              <label htmlFor={`note-${c.id}`}>Clearance note (at least 10 characters)</label>
              <input id={`note-${c.id}`} value={note[c.id] ?? ""} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} />
              <button type="button" onClick={() => clear(c.id)}>Clear case</button>
            </>
          )}
        </div>
      ))}
      {message && <p className="muted" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

function KycPanel({ token, canDecide }: { token: string; canDecide: boolean }) {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [reason, setReason] = useState("");
  const { message, error, run } = useAction();
  const lookup = () => run(async () => {
    setStatus(await api<KycStatus>(`/admin/kyc/${userId.trim()}`, { token }));
  });
  const decide = (decision: "APPROVE" | "REJECT" | "REQUEST_INFO") => run(async () => {
    await api(`/admin/kyc/${userId.trim()}/decision`, { method: "POST", token, body: { decision, reason } });
    setStatus(await api<KycStatus>(`/admin/kyc/${userId.trim()}`, { token }));
    return `Decision recorded: ${decision.replace(/_/g, " ").toLowerCase()}.`;
  });
  return (
    <Panel title="Identity checks">
      <label htmlFor="kyc-user">Customer ID</label>
      <input id="kyc-user" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <button type="button" onClick={lookup} disabled={!userId.trim()}>Look up</button>
      {status && (
        <div>
          <p>Status: <strong>{status.status.replace(/_/g, " ").toLowerCase()}</strong> · tier {status.tier.toLowerCase()}</p>
          <p className="muted">Identifiers are masked. Missing: {status.missing.length ? status.missing.join("; ") : "nothing"}</p>
          <p className="muted">Documents: {status.documents.length} · {status.documents.map((d) => `${d.kind.toLowerCase()} (${d.scanStatus.toLowerCase()})`).join(", ") || "none"}</p>
        </div>
      )}
      {canDecide && status && (
        <>
          <label htmlFor="kyc-reason">Reason (at least 10 characters)</label>
          <input id="kyc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" onClick={() => decide("APPROVE")} disabled={reason.length < 10}>Approve</button>{" "}
          <button type="button" onClick={() => decide("REJECT")} disabled={reason.length < 10}>Reject</button>{" "}
          <button type="button" onClick={() => decide("REQUEST_INFO")} disabled={reason.length < 10}>Request information</button>
        </>
      )}
      {message && <p className="muted" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

function DocumentPanel({ token }: { token: string }) {
  const [fileId, setFileId] = useState("");
  const [reason, setReason] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const { error, run } = useAction();
  const open = () => run(async () => {
    const next = await apiBlob(`/admin/kyc/documents/${fileId.trim()}?reason=${encodeURIComponent(reason)}`, token);
    if (url) URL.revokeObjectURL(url);
    setUrl(next);
  });
  return (
    <Panel title="Identity document (audited)">
      <p className="muted">Each view is recorded with your reason. Reasons must be at least 10 characters.</p>
      <label htmlFor="doc-id">Document ID</label>
      <input id="doc-id" value={fileId} onChange={(e) => setFileId(e.target.value)} />
      <label htmlFor="doc-reason">Reason for viewing</label>
      <input id="doc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" onClick={open} disabled={!fileId.trim() || reason.length < 10}>Open document</button>
      {url && <p><a href={url} target="_blank" rel="noopener noreferrer">Open in a new tab</a></p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

function RevealPanel({ token }: { token: string }) {
  const [userId, setUserId] = useState("");
  const [field, setField] = useState<"PAN" | "PASSPORT" | "DATE_OF_BIRTH">("PAN");
  const [reason, setReason] = useState(REVEAL_REASONS[0]!);
  const [value, setValue] = useState<string | null>(null);
  const { error, run } = useAction();
  const reveal = () => run(async () => {
    const r = await api<{ value: string | null }>(`/admin/customers/${userId.trim()}/reveal`, { method: "POST", token, body: { field, reason } });
    setValue(r.value);
  });
  return (
    <Panel title="Reveal a field (logged)">
      <p className="muted">Shows one value in full. The reason is recorded in the audit log before the value is shown.</p>
      <label htmlFor="rv-user">Customer ID</label>
      <input id="rv-user" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <label htmlFor="rv-field">Field</label>
      <select id="rv-field" value={field} onChange={(e) => setField(e.target.value as typeof field)}>
        <option value="PAN">PAN</option>
        <option value="PASSPORT">Passport number</option>
        <option value="DATE_OF_BIRTH">Date of birth</option>
      </select>
      <label htmlFor="rv-reason">Reason code</label>
      <select id="rv-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REVEAL_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ").toLowerCase()}</option>)}
      </select>
      <button type="button" onClick={reveal} disabled={!userId.trim()}>Reveal</button>
      {value !== null && <p><strong>{value ?? "No value on file"}</strong></p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

interface AuditRow {
  id: string;
  action: string;
  subjectType: string;
  createdAt: string;
}

function AuditPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const { error, run } = useAction();
  const load = () => run(async () => {
    setRows((await api<{ items: AuditRow[] }>("/admin/audit?limit=25", { token })).items);
  });
  return (
    <Panel title="Recent audit entries">
      <button type="button" onClick={load}>Load</button>
      {rows && (
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Subject</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.action}</td>
                <td>{r.subjectType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}

type Column = [label: string, key: string, kind: "text" | "date"];

/** Read-only table. Values come from the API, which has already applied the role's masking. */
function ListPanel({ title, path, token, columns }: { title: string; path: string; token: string; columns: Column[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const { error, run } = useAction();
  const load = () => run(async () => {
    setRows((await api<{ items: Record<string, unknown>[] }>(path, { token })).items);
  });
  return (
    <Panel title={title}>
      <button type="button" onClick={load}>Load</button>
      {rows && rows.length === 0 && <p className="muted">Nothing to show.</p>}
      {rows && rows.length > 0 && (
        <table>
          <thead>
            <tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={String(r["id"] ?? r["userId"] ?? i)}>
                {columns.map(([label, key, kind]) => (
                  <td key={label}>{kind === "date" ? new Date(String(r[key])).toLocaleString() : String(r[key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  );
}
