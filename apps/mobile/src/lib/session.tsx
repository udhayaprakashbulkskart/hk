import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Session storage. Native: the device secure store (Keychain / Keystore).
 * Web preview: memory only. Nothing is written to localStorage.
 * The token below is a sandbox marker, not a credential. Real tokens arrive with the Phase 4 API.
 */
const KEY = "hkf.session";
const SANDBOX_TOKEN = "sandbox-session";

type Status = "loading" | "signed-out" | "signed-in";
interface SessionCtx {
  status: Status;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);
let memoryToken: string | null = null;

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") return memoryToken;
  return SecureStore.getItemAsync(KEY);
}
async function writeToken(v: string | null): Promise<void> {
  memoryToken = v;
  if (Platform.OS === "web") return;
  if (v) await SecureStore.setItemAsync(KEY, v);
  else await SecureStore.deleteItemAsync(KEY);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    readToken()
      .then((t) => setStatus(t ? "signed-in" : "signed-out"))
      .catch(() => setStatus("signed-out"));
  }, []);

  const signIn = useCallback(async () => {
    await writeToken(SANDBOX_TOKEN);
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    await writeToken(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
