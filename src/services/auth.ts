const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

export const authApi = {
  register: (name: string, email: string, password: string) =>
    post<void>('/auth/register', { name, email, password }),

  login: (email: string, password: string) =>
    post<void>('/auth/login', { email, password }),

  /** Uses httpOnly refresh_token cookie — rotates and sets new access_token cookie */
  refresh: () => post<void>('/auth/refresh'),

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
