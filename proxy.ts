import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

/**
 * Everything requires a login (the Leads view exposes customer names, phones,
 * emails and notes). Unauthenticated page requests go to /login; API requests
 * get a 401.
 *
 * Without DASHBOARD_PASSWORD the site stays open in local dev but refuses to
 * serve in production, so a missing env var can't silently make it public.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("DASHBOARD_PASSWORD is not configured", { status: 503 });
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Static build assets and the login page's brand images stay public. The
  // weekly-report cron is called by Vercel with its own CRON_SECRET.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|malpa-logo|api/cron/).*)"],
};
