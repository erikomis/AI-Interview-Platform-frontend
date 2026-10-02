const DEFAULT_BACKEND_URL = "http://localhost:8080";

/** Backend URL as seen from the browser (inlined at build time). */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;

/** Socket.IO URL as seen from the browser (inlined at build time). */
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? BACKEND_URL;

/**
 * Backend URL for server-side code (server components, server actions).
 * Inside Docker this should point at the backend service name (e.g. http://backend:8080),
 * read at runtime from BACKEND_URL.
 */
export const SERVER_BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;

/** Picks the right backend URL for the current runtime. */
export const getBackendUrl = (): string =>
  typeof window === "undefined" ? SERVER_BACKEND_URL : BACKEND_URL;
