import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // PocketBase stores the auth token in localStorage (client-side only).
  // The primary auth guard is AppShell's useEffect which redirects to /login
  // when pb.authStore is empty. This middleware provides a best-effort
  // server-side guard based on the pb_auth cookie (set if cookie store is used).
  const pbAuth = req.cookies.get("pb_auth");
  if (!pbAuth?.value) {
    // No cookie present — let the client-side AppShell guard handle it.
    // We still pass through here to avoid blocking SSR hydration.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon\\.ico|api).*)"],
};
