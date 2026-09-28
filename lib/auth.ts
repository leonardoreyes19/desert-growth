// Session auth for the whole dashboard. The session cookie holds an HMAC of
// DASHBOARD_PASSWORD, so changing the password logs everyone out. Uses Web
// Crypto so it runs in both proxy.ts and server actions.

export const SESSION_COOKIE = "dg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("desert-growth-session-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only same-site relative paths, so ?next= can't redirect off-site. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}
