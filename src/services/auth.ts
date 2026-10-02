import { getBackendUrl } from '@/lib/config';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function toError(res: Response): Promise<HttpError> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  return new HttpError(res.status, err.message ?? res.statusText);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getBackendUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw await toError(res);

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${getBackendUrl()}${path}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

// ─── Single-flight refresh ────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

/**
 * Rotates the httpOnly refresh_token cookie and sets a new access_token cookie.
 * Concurrent callers (StrictMode double mount, parallel 401s, refresh timer,
 * socket reconnect) share one in-flight request. Resolves true on success.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${getBackendUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.ok) return true;
        // 409 "Token already rotated": another tab won the race and already set
        // fresh cookies — confirm the session is usable before giving up.
        if (res.status === 409) {
          const me = await fetch(`${getBackendUrl()}/auth/me`, { credentials: 'include', cache: 'no-store' });
          return me.ok;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ─── Session helpers (browser only) ───────────────────────────────────────────

export function setSessionHint(value: boolean) {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = 'session_hint=1; path=/; SameSite=Lax; max-age=604800';
  } else {
    document.cookie = 'session_hint=; path=/; max-age=0';
  }
}

/** Current locale prefix from the URL ("" for the default locale, "/en" otherwise). */
export function currentLocalePrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.match(/^\/en(?=\/|$)/)?.[0] ?? '';
}

/** Clears the session hint and hard-redirects to the (locale-aware) login page. */
export function redirectToLogin() {
  if (typeof window === 'undefined') return;
  setSessionHint(false);
  const prefix = currentLocalePrefix();
  const path = window.location.pathname.replace(/^\/(?:en|pt)(?=\/|$)/, '') || '/';
  if (path === '/login') return;
  const next = path !== '/' ? `?next=${encodeURIComponent(path)}` : '';
  window.location.href = `${prefix}/login${next}`;
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

export const authApi = {
  register: (name: string, email: string, password: string) =>
    post<void>('/auth/register', { name, email, password }),

  login: (email: string, password: string) =>
    post<void>('/auth/login', { email, password }),

  /** Uses httpOnly refresh_token cookie — rotates and sets new access_token cookie */
  refresh: async () => {
    if (!(await refreshSession())) throw new HttpError(401, 'Session expired');
  },

  logout: () => post<void>('/auth/logout'),

  logoutAll: () => post<void>('/auth/logout-all'),

  me: () => get<AuthUser>('/auth/me'),

  verifyEmail: (token: string) =>
    get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  resendVerification: () => post<void>('/auth/resend-verification'),

  forgotPassword: (email: string) =>
    post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    post<{ message: string }>('/auth/reset-password', { token, newPassword }),
};
