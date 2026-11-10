import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fp_session";

/**
 * Optimistic redirects only: checks that a session cookie exists. The
 * protected layout verifies the session with FastAPI on every request.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const url = request.nextUrl.clone();
  url.search = "";

  if (request.nextUrl.pathname === "/") {
    url.pathname = hasSession ? "/dashboard" : "/welcome";
    return NextResponse.redirect(url);
  }

  if (!hasSession) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/patients/:path*", "/clinician/:path*", "/settings/:path*"],
};
