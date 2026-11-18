/** Minimal cookie-aware HTTP client for integration tests against a running server. */
export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export class Client {
  cookie = "";
  async req<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("ps_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const json = (await res.json().catch(() => null)) as { ok: boolean; data: T; error?: string; fields?: Record<string, string> } | null;
    return { status: res.status, json, data: json?.data as T };
  }
  get = <T = any>(p: string) => this.req<T>("GET", p);
  post = <T = any>(p: string, b: unknown = {}, h?: Record<string, string>) => this.req<T>("POST", p, b, h);
  patch = <T = any>(p: string, b: unknown = {}) => this.req<T>("PATCH", p, b);
  put = <T = any>(p: string, b: unknown = {}) => this.req<T>("PUT", p, b);
  del = <T = any>(p: string) => this.req<T>("DELETE", p);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export async function register(name = "Test User") {
  const c = new Client();
  const email = `t_${uid()}@test.dev`;
  const r = await c.post("/api/auth/register", { name, email, password: "Passw0rd!", acceptTerms: true });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.json)}`);
  return Object.assign(c, { email });
}

export async function login(email: string, password: string) {
  const c = new Client();
  const r = await c.post("/api/auth/login", { email, password });
  if (r.status !== 200) throw new Error(`login failed ${r.status}`);
  return c;
}
