import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide password (HTTP Basic Auth) — the Leads view exposes customer
 * names, phones, emails and notes. The browser asks once and remembers it.
 * Any username works; only DASHBOARD_PASSWORD is checked.
 *
 * Without DASHBOARD_PASSWORD the site stays open in local dev but refuses to
 * serve in production, so a missing env var can't silently make it public.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("DASHBOARD_PASSWORD is not configured", { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, password)) return NextResponse.next();
    } catch {
      // malformed header — fall through to the challenge
    }
  }

  return new NextResponse("Contraseña requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Desert Growth", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // The weekly-report cron is called by Vercel with its own CRON_SECRET.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
};
