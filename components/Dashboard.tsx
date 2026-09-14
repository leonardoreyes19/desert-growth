"use client";

import { useState, type ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import * as SwitchPrimitive from "radix-ui/switch";
import { formatMinutes } from "@/lib/metrics";
import type {
  ConversionSummary,
  DayCount,
  ResponseTimeSummary,
  SourceCount,
  StalledSummary,
  StageCount,
  WeekOverWeek,
} from "@/lib/metrics";
import type { MetaInsights } from "@/lib/meta";
import { getDict, localeFor, type Lang } from "@/lib/i18n";
import { setClientCookie, setHtmlThemeAttribute } from "@/lib/client-cookies";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { SectionLabel } from "@/components/SectionLabel";

type Theme = "light" | "dark";
type MetaInsightsOk = Extract<MetaInsights, { byCampaign: unknown }>;
type Dict = ReturnType<typeof getDict>;

export type DashboardProps = {
  companyName: string;
  contactsCount: number;
  opportunitiesCount: number;
  generatedAtIso: string;
  wow: WeekOverWeek;
  conversion: ConversionSummary;
  responseTime: ResponseTimeSummary;
  bySource: SourceCount[];
  overTime: DayCount[];
  byCity: SourceCount[];
  byStage: StageCount[];
  byPipeline: SourceCount[];
  stalled: StalledSummary;
  meta: MetaInsights;
  initialLang: Lang;
  initialTheme: Theme;
};

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

function SourceGroup({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-3xl p-5 sm:p-7 flex flex-col gap-8"
      style={{ background: "color-mix(in srgb, var(--surface-1) 60%, transparent)", border: `1px solid ${accent}`, borderLeftWidth: 4 }}
    >
      <div>
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}

function formatDemographicLabel(segment: string, t: Dict): string {
  const [age, gender] = segment.split("|");
  const genderLabel = gender === "male" ? t.genderMale : gender === "female" ? t.genderFemale : t.genderUnknown;
  return `${age} · ${genderLabel}`;
}

function formatPlacementLabel(segment: string): string {
  const [platform, position] = segment.split("|");
  const platformLabel = platform && platform !== "unknown" ? platform[0].toUpperCase() + platform.slice(1) : "?";
  return position ? `${platformLabel} · ${position}` : platformLabel;
}

function MetaAdsPanel({ meta, t, locale }: { meta: MetaInsightsOk; t: Dict; locale: string }) {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: meta.currency, maximumFractionDigits: 0 }).format(n);
  const money2 = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: meta.currency, maximumFractionDigits: 2 }).format(n);

  const wow = meta.weekOverWeek;
  const chartLabels = { viewTable: t.viewTable, viewChart: t.viewChart, category: t.category, value: t.value };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t.metaSpend30d} value={money(meta.spend)} />
        <StatTile
          label={t.metaCpl}
          value={meta.cpl != null ? money2(meta.cpl) : "—"}
          sublabel={t.metaLeadsReported(meta.leads.toLocaleString(locale))}
          accent="good"
        />
        <StatTile label={t.metaCtr} value={`${meta.ctr.toFixed(2)}%`} sublabel={t.metaClicks(meta.clicks.toLocaleString(locale))} />
        <StatTile
          label={t.metaReach}
          value={meta.reach.toLocaleString(locale)}
          sublabel={t.metaImpressionsCpm(meta.impressions.toLocaleString(locale), money2(meta.cpm))}
        />
      </div>

      {meta.byDay.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
            {t.metaDailyTrend}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LineChart
              title={t.metaSpendPerDay}
              data={meta.byDay.map((d) => ({ date: d.date, value: Math.round(d.spend) }))}
              locale={locale}
              hoverLabelPrefix={t.spendCol.toLowerCase()}
            />
            <LineChart
              title={t.metaLeadsPerDay}
              data={meta.byDay.map((d) => ({ date: d.date, value: d.leads }))}
              locale={locale}
              hoverLabelPrefix={t.leadsCol.toLowerCase()}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <StatTile
          label={t.metaSpendThisWeek}
          value={money(wow.thisWeekSpend)}
          delta={wow.spendDeltaPct !== null ? { pct: wow.spendDeltaPct, caption: t.vsLastWeekAmount(money(wow.lastWeekSpend)) } : null}
        />
        <StatTile
          label={t.leadsThisWeek}
          value={wow.thisWeekLeads.toLocaleString(locale)}
          delta={wow.leadsDeltaPct !== null ? { pct: wow.leadsDeltaPct, caption: t.vsLastWeekAmount(wow.lastWeekLeads.toLocaleString(locale)) } : null}
        />
        <StatTile
          label={t.metaCplThisWeek}
          value={wow.cplThisWeek != null ? money2(wow.cplThisWeek) : "—"}
          sublabel={wow.cplLastWeek != null ? t.vsLastWeekAmount(money2(wow.cplLastWeek)) : undefined}
        />
      </div>

      {(meta.byDemographic.length > 0 || meta.byPlacement.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {meta.byDemographic.length > 0 && (
            <BarChart
              title={t.metaByDemographic}
              data={meta.byDemographic.map((d) => ({ label: formatDemographicLabel(d.segment, t), value: Math.round(d.spend) }))}
              formatValue={money}
              labels={chartLabels}
            />
          )}
          {meta.byPlacement.length > 0 && (
            <BarChart
              title={t.metaByPlacement}
              data={meta.byPlacement.map((d) => ({ label: formatPlacementLabel(d.segment), value: Math.round(d.spend) }))}
              formatValue={money}
              labels={chartLabels}
            />
          )}
        </div>
      )}

      <div
        className="rounded-2xl p-5 sm:p-6 mt-4 overflow-x-auto"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
      >
        <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
          {t.metaCampaignPerformance}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-secondary)" }}>
              <th className="text-left font-normal pb-2">{t.campaignCol}</th>
              <th className="text-right font-normal pb-2">{t.spendCol}</th>
              <th className="text-right font-normal pb-2">{t.clicksCol}</th>
              <th className="text-right font-normal pb-2">{t.ctrCol}</th>
              <th className="text-right font-normal pb-2">{t.leadsCol}</th>
              <th className="text-right font-normal pb-2">{t.cplCol}</th>
            </tr>
          </thead>
          <tbody>
            {meta.byCampaign.map((c) => (
              <tr key={c.name} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-2 pr-3" style={{ color: "var(--text-primary)" }}>{c.name}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{money(c.spend)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{c.clicks.toLocaleString(locale)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{c.ctr.toFixed(2)}%</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{c.leads.toLocaleString(locale)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{c.cpl != null ? money2(c.cpl) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        {t.metaLeadsFootnote}
      </p>
    </>
  );
}

export function Dashboard(props: DashboardProps) {
  const {
    companyName,
    contactsCount,
    opportunitiesCount,
    generatedAtIso,
    wow,
    conversion,
    responseTime,
    bySource,
    overTime,
    byCity,
    byStage,
    byPipeline,
    stalled,
    meta,
    initialLang,
    initialTheme,
  } = props;

  const [lang, setLang] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const t = getDict(lang);
  const locale = localeFor(lang);
  const metaOk = meta.configured && meta.error === undefined ? meta : null;

  function changeLang(next: Lang) {
    setLang(next);
    setClientCookie("lang", next);
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    setClientCookie("theme", next);
    setHtmlThemeAttribute(next);
  }

  const generatedAt = new Date(generatedAtIso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Hermosillo",
  });

  const chartLabels = { viewTable: t.viewTable, viewChart: t.viewChart, category: t.category, value: t.value };

  const isPartnership = companyName.includes("/");
  const [leadGenPartner, salesCompany] = isPartnership
    ? companyName.split("/").map((s) => s.trim())
    : [null, companyName];
  const companyInitial = isPartnership
    ? (leadGenPartner?.[0] || "") + (salesCompany?.[0] || "")
    : companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--page-plane)" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 flex flex-col gap-10">
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
                {t.contactsAndOpportunities(contactsCount, opportunitiesCount)}
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

        <SourceGroup title={t.crmGroupTitle} subtitle={t.crmGroupSubtitle} accent="var(--series-1)">
        <section>
          <SectionLabel>{t.summary}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label={t.leadsThisWeek}
              value={wow.thisWeek.toLocaleString(locale)}
              delta={wow.deltaPct !== null ? { pct: wow.deltaPct, caption: t.vsLastWeek(wow.lastWeek) } : null}
            />
            <StatTile
              label={t.closeRate}
              value={`${(conversion.winRate * 100).toFixed(0)}%`}
              sublabel={t.wonOfClosed(conversion.won, conversion.won + conversion.lost)}
              accent={conversion.winRate >= 0.4 ? "good" : conversion.winRate > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label={t.medianFirstContact}
              value={formatMinutes(responseTime.medianMinutes)}
              sublabel={responseTime.sampleSize > 0 ? t.overLeadsTracked(responseTime.sampleSize) : t.notEnoughData}
              accent="good"
            />
          </div>
        </section>

        <section>
          <SectionLabel>{t.leadAcquisition}</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChart title={t.leadsBySourceCampaign} data={bySource} labels={chartLabels} />
            <LineChart title={t.newLeadsPerDay} data={overTime} locale={locale} hoverLabelPrefix={t.leadsOnPrefix} />
          </div>
          <div className="grid grid-cols-1 mt-4">
            <BarChart title={t.leadsByCity} data={byCity} labels={chartLabels} />
          </div>
        </section>

        <section>
          <SectionLabel>{t.salesPipeline}</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-4">
            <BarChart
              title={t.opportunitiesByStage}
              data={byStage.map((s) => ({ label: s.label, value: s.value }))}
              labels={chartLabels}
            />
            <StatTile
              label={t.stalledLeads}
              value={stalled.stalledCount.toLocaleString(locale)}
              sublabel={t.stalledSublabel(stalled.openCount, stalled.thresholdDays)}
              accent={stalled.stalledCount > 0 ? "warning" : "good"}
            />
          </div>
          <BarChart title={t.opportunitiesByProductLine} data={byPipeline} labels={chartLabels} />
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            {t.lithiumFootnote}
          </p>
        </section>

        <section>
          <SectionLabel>{t.responseSpeed}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label={t.responseUnder5min}
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.under5min / responseTime.sampleSize) * 100)}%` : "—"}
              accent="good"
            />
            <StatTile
              label={t.responseUnder1hour}
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.under1hour / responseTime.sampleSize) * 100)}%` : "—"}
              accent="good"
            />
            <StatTile
              label={t.noResponse24h}
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.overADay / responseTime.sampleSize) * 100)}%` : "—"}
              accent={responseTime.overADay > 0 ? "warning" : "neutral"}
            />
          </div>
        </section>
        </SourceGroup>

        <SourceGroup title={t.metaGroupTitle} subtitle={t.metaGroupSubtitle} accent="#9333ea">
          <section>
            <SectionLabel>{t.advertisingMetaAds}</SectionLabel>
            {!meta.configured ? (
              <div
                className="rounded-2xl p-5 text-sm"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
              >
                {t.metaNotConfigured}
              </div>
            ) : meta.error !== undefined ? (
              <div
                className="rounded-2xl p-5 text-sm"
                style={{ background: "var(--surface-1)", border: "1px solid var(--status-warning)", color: "var(--text-secondary)" }}
              >
                {t.metaError(meta.error)}
              </div>
            ) : metaOk ? (
              <MetaAdsPanel meta={metaOk} t={t} locale={locale} />
            ) : null}
          </section>
        </SourceGroup>

        <footer className="text-xs pt-2 pb-6 border-t" style={{ color: "var(--text-muted)", borderColor: "var(--gridline)" }}>
          <p className="pt-4">{t.firstContactFootnote}</p>
        </footer>
      </div>
    </div>
  );
}
