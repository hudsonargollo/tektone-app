import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "tk_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type AuthUser = {
  email: string;
  name: string | null;
  admin: boolean;
  avatar: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  // Login/signup screens only get a token back from the API (no admin/avatar
  // in that response) — signIn persists it, then re-fetches the authoritative
  // user via the same bootstrap() the app uses on cold start.
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, bootstrap }: { children: ReactNode; bootstrap: () => Promise<AuthUser | null> }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const u = await bootstrap();
        setUser(u);
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (token: string) => {
      await setToken(token);
      const u = await bootstrap();
      setUser(u);
    },
    [bootstrap]
  );

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
