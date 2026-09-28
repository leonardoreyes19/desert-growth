"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import * as SwitchPrimitive from "radix-ui/switch";
import { getDict, localeFor, type Lang } from "@/lib/i18n";
import { setClientCookie, setHtmlThemeAttribute } from "@/lib/client-cookies";

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

function ThemeSwitch({ theme, onChange, label }: { theme: Theme; onChange: (t: Theme) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      <SwitchPrimitive.Root
        checked={theme === "dark"}
        onCheckedChange={(checked) => onChange(checked ? "dark" : "light")}
        aria-label={label}
        title={label}
        className="w-9 h-5 rounded-full relative shrink-0 outline-none cursor-pointer transition-colors"
        style={{ background: theme === "dark" ? "var(--series-1)" : "var(--gridline)" }}
      >
        <SwitchPrimitive.Thumb
          className="block w-4 h-4 rounded-full transition-transform"
          style={{
            background: "#ffffff",
            transform: theme === "dark" ? "translateX(18px)" : "translateX(2px)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </SwitchPrimitive.Root>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </div>
  );
}

function LangSwitch({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={lang}
      onValueChange={(next) => next && onChange(next as Lang)}
      aria-label={label}
      className="inline-flex rounded-full overflow-hidden shrink-0"
      style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-1)" }}
    >
      {(["es", "en"] as Lang[]).map((code) => (
        <ToggleGroup.Item
          key={code}
          value={code}
          className="w-8 h-6 text-xs font-medium uppercase transition-colors outline-none cursor-pointer"
          style={{
            color: lang === code ? "#ffffff" : "var(--text-secondary)",
            background: lang === code ? "var(--series-1)" : "transparent",
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
  return (
    <nav
      className="inline-flex rounded-full p-1 gap-1 w-fit max-w-full overflow-x-auto"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)" }}
    >
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors whitespace-nowrap"
            style={{
              color: active ? "#ffffff" : "var(--text-secondary)",
              background: active ? "var(--series-1)" : "transparent",
            }}
          >
            {t[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppHeader({
  companyName,
  subtitle,
  generatedAtIso,
  prefs,
}: {
  companyName: string;
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

  const isPartnership = companyName.includes("/");
  const [leadGenPartner, salesCompany] = isPartnership
    ? companyName.split("/").map((s) => s.trim())
    : [null, companyName];
  const companyInitial = isPartnership
    ? (leadGenPartner?.[0] || "") + (salesCompany?.[0] || "")
    : companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col gap-5">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-semibold shrink-0"
              style={{ background: "var(--series-1)", color: "#ffffff" }}
              aria-hidden
            >
              {companyInitial}
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                {companyName}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {isPartnership ? t.partnership(leadGenPartner ?? "", salesCompany ?? "") : t.growthReport}
                {" · "}
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-3">
              <LangSwitch lang={lang} onChange={changeLang} label={t.language} />
              <ThemeSwitch theme={theme} onChange={changeTheme} label={t.toggleTheme} />
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
              style={{ background: "color-mix(in srgb, var(--status-good) 14%, transparent)", color: "var(--status-good)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-good)" }} />
              {t.liveData}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t.updatedAt(generatedAt)}
            </span>
          </div>
        </header>
      <NavTabs t={t} />
    </div>
  );
}
