import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED = ["/interview", "/history"];
const AUTH_ONLY = ["/login", "/register"];

/** Strip locale prefix (e.g. /en/login → /login) for path matching */
function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(?:en|pt)(?=\/|$)/, "") || "/";
}

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + "/"));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = stripLocale(pathname);
  const hasSession = request.cookies.has("session_hint");

  const localePrefix = pathname.match(/^\/(?:en|pt)(?=\/|$)/)?.[0] ?? "";

  if (matches(path, PROTECTED) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/login`;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (matches(path, AUTH_ONLY) && hasSession) {
    return NextResponse.redirect(new URL(`${localePrefix}/`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
