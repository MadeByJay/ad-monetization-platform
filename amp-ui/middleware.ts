import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico";
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthPath = pathname.startsWith("/auth");
  if (isStatic || isApiRoute || isAuthPath) return NextResponse.next();

  const cookieName =
    process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME || "amp_session";
  const hasSession = !!request.cookies.get(cookieName)?.value;

  if (pathname === "/") {
    if (hasSession) {
      const url = new URL("/dashboard", request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets).*)"],
};
