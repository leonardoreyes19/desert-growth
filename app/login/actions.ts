"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, safeNextPath, sessionToken } from "@/lib/auth";

export type LoginState = { error: "invalid" | "notConfigured" | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return { error: "notConfigured" };

  const given = String(formData.get("password") ?? "");
  if (!safeEqual(given, password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "invalid" };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
