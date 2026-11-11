import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { TokenPair } from "@hkfinhub/api-client";
import { authClient } from "./auth";

/**
 * Session state. The access token stays in memory. The refresh token is kept in the device secure
 * store (iOS Keychain, Android Keystore) so the app can restore the session on launch.
 * On the web preview nothing is persisted: a reload ends the session.
 */
const REFRESH_KEY = "hkf.refreshToken";

type Status = "loading" | "signed-out" | "signed-in";
interface SessionCtx {
  status: Status;
  accessToken: string | null;
  signIn: (tokens: TokenPair) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

async function readRefresh(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(REFRESH_KEY);
}
async function writeRefresh(v: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  if (v) await SecureStore.setItemAsync(REFRESH_KEY, v);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const access = useRef<string | null>(null);

  const remember = useCallback(async (tokens: { accessToken: string; refreshToken: string }) => {
    access.current = tokens.accessToken;
    setAccessToken(tokens.accessToken);
    await writeRefresh(tokens.refreshToken);
    setStatus("signed-in");
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const stored = await readRefresh();
        if (!stored) return live && setStatus("signed-out");
        const fresh = await authClient.refresh(stored);
        if (live) await remember(fresh);
      } catch {
        await writeRefresh(null).catch(() => undefined);
        if (live) setStatus("signed-out");
      }
    })();
    return () => { live = false; };
  }, [remember]);

  const signIn = useCallback(async (tokens: TokenPair) => {
    await remember(tokens);
  }, [remember]);

  const signOut = useCallback(async () => {
    const token = access.current;
    access.current = null;
    setAccessToken(null);
    if (token) await authClient.logout(token).catch(() => undefined);
    await writeRefresh(null).catch(() => undefined);
    setStatus("signed-out");
  }, []);

  const value = useMemo(() => ({ status, accessToken, signIn, signOut }), [status, accessToken, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
