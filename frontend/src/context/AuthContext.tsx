import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, setUnauthorizedHandler, tokenStore } from "../services/api";
import type { User } from "../services/types";
import { useI18n } from "../i18n";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Parameters<typeof authApi.register>[0]) => Promise<User>;
  logout: () => void;
  /** true after the user clicked Logout (so we don't offer a 'return to' page). */
  loggedOut: boolean;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!tokenStore.get());
  const [loggedOut, setLoggedOut] = useState(false);
  const { setLang } = useI18n();

  const logout = useCallback(() => {
    tokenStore.clear();
    setLoggedOut(true);
    setUser(null);
  }, []);

  const expire = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(expire);
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback(
    (token: string, u: User) => {
      tokenStore.set(token);
      setLoggedOut(false);
      setUser(u);
      setLang(u.preferred_language);
      return u;
    },
    [setLang],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      logout,
      loggedOut,
      setUser,
      login: async (email, password) => {
        const r = await authApi.login(email, password);
        return accept(r.access_token, r.user);
      },
      register: async (body) => {
        const r = await authApi.register(body);
        return accept(r.access_token, r.user);
      },
    }),
    [user, loading, logout, loggedOut, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
