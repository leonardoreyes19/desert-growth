"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import { getDict, localeFor, type Lang } from "@/lib/i18n";
import { setClientCookie, setHtmlThemeAttribute } from "@/lib/client-cookies";
import { logout } from "@/app/login/actions";
import { Icon } from "@/components/icons";

export type Theme = "light" | "dark";
export type Dict = ReturnType<typeof getDict>;

/** Language + theme state, persisted to cookies client-side (no server round-trip). */
export function usePrefs(initialLang: Lang, initialTheme: Theme) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function changeLang(next: Lang) {
    setLang(next);
    setClientCookie("lang", next);
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    setClientCookie("theme", next);
    setHtmlThemeAttribute(next);
  }

  return { lang, theme, t: getDict(lang), locale: localeFor(lang), changeLang, changeTheme };
}

const iconButton =
  "w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors outline-none hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--series-1)]";

function ThemeToggle({ theme, onChange, label }: { theme: Theme; onChange: (t: Theme) => void; label: string }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => onChange(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={iconButton}
      style={{ color: "var(--text-secondary)" }}
    >
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}

function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={lang}
      onValueChange={(next) => next && onChange(next as Lang)}
      aria-label={label}
      className="inline-flex rounded-full p-0.5 shrink-0"
      style={{ background: "color-mix(in srgb, var(--text-primary) 6%, transparent)" }}
    >
      {(["es", "en"] as Lang[]).map((code) => (
        <ToggleGroup.Item
          key={code}
          value={code}
          className="h-7 px-2.5 rounded-full text-xs font-semibold uppercase transition-all outline-none cursor-pointer"
          style={{
            color: lang === code ? "var(--text-primary)" : "var(--text-muted)",
            background: lang === code ? "var(--surface-1)" : "transparent",
            boxShadow: lang === code ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          }}
        >
          {code}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

const NAV = [
  { href: "/", key: "navSummary" },
  { href: "/dinero", key: "navMoney" },
  { href: "/leads", key: "navLeads" },
] as const;

function NavTabs({ t }: { t: Dict }) {
  const pathname = usePathname();
  // Keep the chosen period (and month) when switching tabs; Resumen has no "todo", so it falls back to its default there.
  const searchParams = useSearchParams();
  const periodQuery = new URLSearchParams();
  for (const key of ["periodo", "mes"]) {
    const value = searchParams.get(key);
    if (value) periodQuery.set(key, value);
  }
  const suffix = periodQuery.size > 0 ? `?${periodQuery}` : "";
  return (
    <nav
      className="inline-flex rounded-full p-1 gap-0.5 w-fit max-w-full overflow-x-auto"
      style={{ background: "color-mix(in srgb, var(--text-primary) 6%, transparent)" }}
    >
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href + suffix}
            aria-current={active ? "page" : undefined}
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-all whitespace-nowrap"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              background: active ? "var(--surface-1)" : "transparent",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {t[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark({ companyName }: { companyName: string }) {
  const partner = companyName.includes("/") ? companyName.split("/")[0].trim() : null;
  return (
    <Link href="/" className="flex items-center gap-3 shrink-0" aria-label={companyName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/malpa-logo.png" alt="MALPA" width={104} height={18} className="logo-on-light h-[18px] w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/malpa-logo-white.png" alt="MALPA" width={104} height={18} className="logo-on-dark h-[18px] w-auto" />
      {partner && (
        <>
          <span aria-hidden className="h-5 w-px hidden sm:block" style={{ background: "var(--border-hairline)" }} />
          <span className="text-sm font-semibold hidden sm:inline" style={{ color: "var(--text-secondary)" }}>
            {partner}
          </span>
        </>
      )}
    </Link>
  );
}

export function AppHeader({
  companyName,
  title,
  subtitle,
  generatedAtIso,
  prefs,
}: {
  companyName: string;
  title: string;
  subtitle: string;
  generatedAtIso: string;
  prefs: ReturnType<typeof usePrefs>;
}) {
  const { lang, theme, t, locale, changeLang, changeTheme } = prefs;

  const generatedAt = new Date(generatedAtIso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Hermosillo",
  });

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--page-plane) 78%, transparent)",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-10 h-16 flex items-center justify-between gap-4">
          <BrandMark companyName={companyName} />
          <div className="hidden md:block">
            <NavTabs t={t} />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LangSwitch lang={lang} onChange={changeLang} label={t.language} />
            <ThemeToggle theme={theme} onChange={changeTheme} label={t.toggleTheme} />
            <form action={logout}>
              <button type="submit" aria-label={t.logout} title={t.logout} className={iconButton} style={{ color: "var(--text-secondary)" }}>
                <Icon name="logOut" size={17} />
              </button>
            </form>
          </div>
        </div>
        <div className="md:hidden px-4 pb-3 -mt-1">
          <NavTabs t={t} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-10 pt-8 sm:pt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full w-fit shrink-0"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
        >
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: "var(--status-good)" }} />
            <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: "var(--status-good)" }} />
          </span>
          {t.liveData}
          <span style={{ color: "var(--text-muted)" }}>· {t.updatedAt(generatedAt)}</span>
        </div>
      </div>
    </>
  );
}
