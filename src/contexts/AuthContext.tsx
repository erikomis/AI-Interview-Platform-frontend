"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  authApi,
  refreshSession,
  redirectToLogin,
  setSessionHint,
  HttpError,
  type AuthUser,
} from "@/services/auth";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh 60 seconds before the 15-min access token expires
const REFRESH_INTERVAL_MS = (15 * 60 - 60) * 1000; // 14 minutes

const isUnauthorized = (err: unknown) => err instanceof HttpError && err.status === 401;

function isOnProtectedPage(): boolean {
  const path = window.location.pathname.replace(/^\/(?:en|pt)(?=\/|$)/, "") || "/";
  return ["/interview", "/history"].some((p) => path === p || path.startsWith(p + "/"));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule silent refresh ──────────────────────────────────────────────
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        await authApi.refresh(); // single-flight, shared with apiFetch / socket
        const user = await authApi.me();
        setState({ user, loading: false });
        scheduleRefresh();
      } catch {
        setSessionHint(false);
        setState({ user: null, loading: false });
        if (isOnProtectedPage()) redirectToLogin();
      }
    }, REFRESH_INTERVAL_MS);
  }, []);

  // ── Try to restore session on mount (uses httpOnly cookies) ─────────────
  // /auth/me first; only refresh when the access token is missing/expired (401).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let user: AuthUser;
        try {
          user = await authApi.me();
        } catch (err) {
          if (!isUnauthorized(err)) throw err;
          await authApi.refresh();
          user = await authApi.me();
        }
        if (!cancelled) {
          setSessionHint(true);
          setState({ user, loading: false });
          scheduleRefresh();
        }
      } catch {
        if (!cancelled) {
          setSessionHint(false);
          setState({ user: null, loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      const user = await authApi.me();
      setSessionHint(true);
      setState({ user, loading: false });
      scheduleRefresh();
    },
    [scheduleRefresh],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await authApi.register(name, email, password);
      const user = await authApi.me();
      setSessionHint(true);
      setState({ user, loading: false });
      scheduleRefresh();
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setSessionHint(false);
    setState({ user: null, loading: false });
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch (err) {
      // Access token expired — refresh once, then retry
      if (isUnauthorized(err) && (await refreshSession())) {
        await authApi.logoutAll().catch(() => {});
      }
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setSessionHint(false);
    setState({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
