import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "tk_token";

// expo-secure-store has no web implementation at all (calling it throws
// "getValueWithKeyAsync is not a function", uncaught, which left the whole
// app on a permanent blank screen when loaded in a browser — the bootstrap
// effect never got past `loading: true`). localStorage is the standard web
// fallback for this; less secure than the Keychain/Keystore SecureStore
// gives native, but web is a dev/testing target here, not the primary
// distribution surface.
export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return window.localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// accessRole/financeAccess/crmRole mirror GET /auth/me's response exactly
// (functions/api/auth/[[path]].js) — accessRole drives which navigator shell
// mounts (see (app)/_layout.tsx's CUSTOMER redirect), financeAccess/crmRole
// gate individual tabs added in later phases. `admin` stays a separate
// derived boolean (accessRole === "ADMIN") for the screens that already
// checked it before this field existed.
export type AccessRole = "ADMIN" | "STAFF" | "CUSTOMER";
export type CrmRole = "partner" | "closer" | "admin" | null;

type AuthUser = {
  email: string;
  name: string | null;
  admin: boolean;
  avatar: string | null;
  accessRole: AccessRole;
  financeAccess: boolean;
  crmRole: CrmRole;
};

// crm_role ladder — mirrors worker/lib/crmRbac.js exactly (partner < closer
// < admin), duplicated here rather than shared since it's three lines and
// lives in a different runtime (same precedent as this codebase's other
// per-runtime small-constant duplicates, e.g. PROJECT_TYPE_LABEL).
const CRM_LADDER: Record<string, number> = { partner: 0, closer: 1, admin: 2 };

export function hasCrmAccess(user: AuthUser | null): boolean {
  return Boolean(user?.crmRole && user.crmRole in CRM_LADDER);
}

export function isCrmCloserOrAbove(user: AuthUser | null): boolean {
  if (!user?.crmRole) return false;
  return CRM_LADDER[user.crmRole] >= CRM_LADDER.closer;
}

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
