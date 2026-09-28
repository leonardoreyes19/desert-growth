import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, safeNextPath, sessionToken } from "@/lib/auth";
import { readPrefs } from "@/lib/data";
import { LoginForm, type LoginCopy } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión · MALPA" };

const COPY = {
  es: {
    eyebrow: "Desert Growth × MALPA",
    title: "Dashboard de crecimiento",
    intro: "Leads, ventas e inversión en anuncios en un solo lugar.",
    footer: "Acceso privado para el equipo de MALPA y Desert Growth",
    form: {
      label: "Contraseña",
      placeholder: "Ingresa la contraseña",
      submit: "Entrar",
      submitting: "Entrando…",
      show: "Mostrar",
      hide: "Ocultar",
      invalid: "Contraseña incorrecta. Inténtalo de nuevo.",
      notConfigured: "El acceso no está configurado todavía.",
    } satisfies LoginCopy,
  },
  en: {
    eyebrow: "Desert Growth × MALPA",
    title: "Growth dashboard",
    intro: "Leads, sales and ad spend in one place.",
    footer: "Private access for the MALPA and Desert Growth team",
    form: {
      label: "Password",
      placeholder: "Enter the password",
      submit: "Sign in",
      submitting: "Signing in…",
      show: "Show",
      hide: "Hide",
      invalid: "Wrong password. Please try again.",
      notConfigured: "Access isn't configured yet.",
    } satisfies LoginCopy,
  },
};

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const [{ next: rawNext }, prefs, cookieStore] = await Promise.all([searchParams, readPrefs(), cookies()]);
  const next = safeNextPath(rawNext);

  const password = process.env.DASHBOARD_PASSWORD;
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (password && session && safeEqual(session, await sessionToken(password))) redirect(next);

  const copy = COPY[prefs.lang];

  return (
    <main className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-4 py-12" style={{ background: "var(--page-plane)" }}>
      {/* Brand stripes, echoing the three slashes in the MALPA logo */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-24 sm:left-0 flex gap-5 sm:gap-7 opacity-90">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[140%] w-6 sm:w-10"
            style={{ background: "var(--brand-red)", transform: "translateY(-15%) skewX(-24deg)", opacity: 1 - i * 0.18 }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -bottom-40 w-[520px] h-[520px] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--brand-red) 10%, transparent)" }}
      />

      <div className="relative w-full max-w-md">
        <div
          className="rounded-3xl px-7 py-9 sm:px-10 sm:py-11 flex flex-col gap-8"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-hairline)",
            boxShadow: "0 1px 2px rgba(11,11,11,0.06), 0 24px 64px rgba(11,11,11,0.12)",
          }}
        >
          <div className="flex flex-col items-center text-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/malpa-logo.png" alt="MALPA" width={220} height={38} className="logo-on-light h-auto w-[220px]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/malpa-logo-white.png" alt="MALPA" width={220} height={38} className="logo-on-dark h-auto w-[220px]" />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--brand-red)" }}>
                {copy.eyebrow}
              </span>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {copy.title}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {copy.intro}
              </p>
            </div>
          </div>

          <LoginForm next={next} copy={copy.form} />
        </div>

        <p className="text-xs text-center mt-6 flex items-center justify-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {copy.footer}
        </p>
      </div>
    </main>
  );
}
