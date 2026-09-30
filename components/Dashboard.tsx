"use client";

import { useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import { formatMinutes } from "@/lib/metrics";
import type {
  ConversionSummary,
  DayCount,
  PipelineSnapshot,
  ResponseTimeSummary,
  SourceCount,
  StalledSummary,
  StageCount,
  WeekOverWeek,
} from "@/lib/metrics";
import type { MetaInsights } from "@/lib/meta";
import type { PipelineHistory } from "@/lib/snapshots";
import type { Lang } from "@/lib/i18n";
import { AppHeader, usePrefs, type Dict, type Theme } from "@/components/AppHeader";
import { StatTile, type Comparison } from "@/components/StatTile";
import { AppFooter } from "@/components/AppFooter";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { SectionLabel } from "@/components/SectionLabel";

type MetaInsightsOk = Extract<MetaInsights, { byCampaign: unknown }>;

export type DashboardProps = {
  companyName: string;
  contactsCount: number;
  opportunitiesCount: number;
  generatedAtIso: string;
  wow: WeekOverWeek;
  newLeadsMonth: WeekOverWeek;
  pipeline: PipelineSnapshot;
  /** null when a tag filter is active (history covers the whole pipeline). */
  pipelineHistory: PipelineHistory | null;
  conversion: ConversionSummary;
  responseTime: ResponseTimeSummary;
  bySource: SourceCount[];
  overTime: DayCount[];
  byCity: SourceCount[];
  byStage: StageCount[];
  byPipeline: SourceCount[];
  stalled: StalledSummary;
  meta: MetaInsights;
  availableTags: string[];
  selectedTag: string | null;
  initialLang: Lang;
  initialTheme: Theme;
};

function TagFilter({
  tags,
  selected,
  onChange,
  label,
  allLabel,
}: {
  tags: string[];
  selected: string | null;
  onChange: (tag: string | null) => void;
  label: string;
  allLabel: string;
}) {
  if (tags.length === 0) return null;
  return (
    <ToggleGroup.Root
      type="single"
      value={selected ?? "__all__"}
      onValueChange={(next) => next && onChange(next === "__all__" ? null : next)}
      aria-label={label}
      className="inline-flex flex-wrap gap-1.5"
    >
      <ToggleGroup.Item
        value="__all__"
        className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors outline-none cursor-pointer"
        style={{
          color: selected === null ? "#ffffff" : "var(--text-secondary)",
          background: selected === null ? "var(--series-1)" : "var(--surface-1)",
          border: "1px solid var(--border-hairline)",
        }}
      >
        {allLabel}
      </ToggleGroup.Item>
      {tags.map((tag) => (
        <ToggleGroup.Item
          key={tag}
          value={tag}
          className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors outline-none cursor-pointer"
          style={{
            color: selected === tag ? "#ffffff" : "var(--text-secondary)",
            background: selected === tag ? "var(--series-1)" : "var(--surface-1)",
            border: "1px solid var(--border-hairline)",
          }}
        >
          {tag}
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
        <StatTile icon="megaphone" label={t.metaSpend30d} value={money(meta.spend)} />
        <StatTile
          icon="users" label={t.metaCpl}
          value={meta.cpl != null ? money2(meta.cpl) : "—"}
          sublabel={t.metaLeadsReported(meta.leads.toLocaleString(locale))}
          accent="good"
        />
        <StatTile icon="mousePointer" label={t.metaCtr} value={`${meta.ctr.toFixed(2)}%`} sublabel={t.metaClicks(meta.clicks.toLocaleString(locale))} />
        <StatTile
          icon="eye" label={t.metaReach}
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
          icon="wallet" label={t.metaSpendThisWeek}
          value={money(wow.thisWeekSpend)}
          delta={wow.spendDeltaPct !== null ? { pct: wow.spendDeltaPct, caption: t.vsLastWeekAmount(money(wow.lastWeekSpend)) } : null}
        />
        <StatTile
          icon="users" label={t.leadsThisWeek}
          value={wow.thisWeekLeads.toLocaleString(locale)}
          delta={wow.leadsDeltaPct !== null ? { pct: wow.leadsDeltaPct, caption: t.vsLastWeekAmount(wow.lastWeekLeads.toLocaleString(locale)) } : null}
        />
        <StatTile
          icon="receipt" label={t.metaCplThisWeek}
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
    newLeadsMonth,
    pipeline,
    pipelineHistory,
    conversion,
    responseTime,
    bySource,
    overTime,
    byCity,
    byStage,
    byPipeline,
    stalled,
    meta,
    availableTags,
    selectedTag,
    initialLang,
    initialTheme,
  } = props;

  const prefs = usePrefs(initialLang, initialTheme);
  const { t, locale } = prefs;
  const router = useRouter();
  const pathname = usePathname();
  const metaOk = meta.configured && meta.error === undefined ? meta : null;

  // The tag filter re-renders on the server; show the new chip right away and dim the numbers until it lands.
  const [isFiltering, startFiltering] = useTransition();
  const [requestedTag, setRequestedTag] = useState<string | null>(selectedTag);
  const shownTag = isFiltering ? requestedTag : selectedTag;

  function changeTag(tag: string | null) {
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    setRequestedTag(tag);
    startFiltering(() => router.push(`${pathname}${query}`));
  }

  const chartLabels = { viewTable: t.viewTable, viewChart: t.viewChart, category: t.category, value: t.value };

  const pctOfSettled = (n: number) =>
    responseTime.settledCount > 0 ? `${Math.round((n / responseTime.settledCount) * 100)}%` : "—";
  const trackingSince = new Date(responseTime.trackingSince).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "America/Hermosillo",
  });
  const settledSublabel =
    responseTime.settledCount > 0 ? t.overSettledLeads(responseTime.settledCount, trackingSince) : t.notEnoughData;

  const pctChange = (current: number, previous: number) => (previous > 0 ? (current - previous) / previous : null);
  const vsHistory = (key: keyof PipelineSnapshot, higherIsBetter = true): Comparison[] => {
    if (!pipelineHistory?.configured) return [];
    const { lastWeek, lastMonth } = pipelineHistory;
    const rows: Comparison[] = [];
    if (lastWeek) rows.push({ pct: pctChange(pipeline[key], lastWeek[key]), caption: t.vsLastWeekClose(lastWeek[key]), higherIsBetter });
    if (lastMonth) rows.push({ pct: pctChange(pipeline[key], lastMonth[key]), caption: t.vsLastMonthClose(lastMonth[key]), higherIsBetter });
    return rows;
  };

  const partners = companyName.split("/").map((p) => p.trim());
  const partnershipLine = partners.length === 2 ? t.partnership(partners[0], partners[1]) : companyName;

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: "var(--page-plane)" }}>
      <AppHeader
        companyName={companyName}
        title={t.growthReport}
        subtitle={`${partnershipLine} · ${t.contactsAndOpportunities(contactsCount, opportunitiesCount)}`}
        generatedAtIso={generatedAtIso}
        prefs={prefs}
      />
      <main
        className="max-w-6xl mx-auto w-full px-4 sm:px-10 py-8 flex flex-col gap-10 flex-1 transition-opacity"
        style={{ opacity: isFiltering ? 0.55 : 1, cursor: isFiltering ? "progress" : undefined }}
        aria-busy={isFiltering}
      >

        <SourceGroup title={t.crmGroupTitle} subtitle={t.crmGroupSubtitle} accent="var(--series-1)">
        {availableTags.length > 0 && (
          <TagFilter tags={availableTags} selected={shownTag} onChange={changeTag} label={t.tagFilterLabel} allLabel={t.allLeads} />
        )}
        <section>
          <SectionLabel>{t.summary}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              icon="users" label={t.leadsThisWeek}
              value={pipeline.inConversation.toLocaleString(locale)}
              sublabel={t.inConversationSublabel}
              comparisons={vsHistory("inConversation")}
            />
            <StatTile
              icon="trendUp" label={t.newLeadsThisWeek}
              value={wow.thisWeek.toLocaleString(locale)}
              comparisons={[
                { pct: wow.deltaPct, caption: t.vsLastWeek(wow.lastWeek) },
                {
                  pct: newLeadsMonth.deltaPct,
                  caption: t.thisMonthVsLastMonth(newLeadsMonth.thisWeek, newLeadsMonth.lastWeek),
                },
              ]}
            />
            <StatTile
              icon="target" label={t.closeRate}
              value={`${(conversion.winRate * 100).toFixed(0)}%`}
              sublabel={t.wonLostOpen(conversion.won, conversion.lost, conversion.open)}
              accent={conversion.winRate >= 0.4 ? "good" : conversion.winRate > 0 ? "warning" : "neutral"}
            />
            <StatTile
              icon="fileText" label={t.openLeads}
              value={pipeline.open.toLocaleString(locale)}
              sublabel={t.openLeadsSublabel}
              comparisons={vsHistory("open")}
            />
            <StatTile
              icon="hourglass" label={t.noResponseLeads}
              value={pipeline.noResponse.toLocaleString(locale)}
              sublabel={t.noResponseLeadsSublabel}
              comparisons={vsHistory("noResponse", false)}
              accent="warning"
            />
            <StatTile
              icon="clock" label={t.medianFirstContact}
              value={formatMinutes(responseTime.medianMinutes)}
              sublabel={responseTime.repliedCount > 0 ? t.overLeadsReplied(responseTime.repliedCount) : t.notEnoughData}
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
              icon="pause" label={t.stalledLeads}
              value={stalled.stalledCount.toLocaleString(locale)}
              sublabel={t.stalledSublabel(stalled.openCount, stalled.thresholdDays)}
              comparisons={stalled.byStage.map((s) => ({ pct: null, caption: `${s.label}: ${s.value.toLocaleString(locale)}` }))}
              action={stalled.stalledCount > 0 ? { href: "/leads?stalled=1", label: t.seeStalledLeads } : undefined}
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
              icon="zap" label={t.responseUnder5min}
              value={pctOfSettled(responseTime.under5min)}
              sublabel={settledSublabel}
              accent="good"
            />
            <StatTile
              icon="clock" label={t.responseUnder1hour}
              value={pctOfSettled(responseTime.under1hour)}
              sublabel={settledSublabel}
              accent="good"
            />
            <StatTile
              icon="alert" label={t.noResponse24h}
              value={pctOfSettled(responseTime.noReplyIn24h)}
              sublabel={settledSublabel}
              accent={responseTime.noReplyIn24h > 0 ? "warning" : "neutral"}
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

      </main>
      <AppFooter t={t}>
        <p>{t.firstContactFootnote}</p>
      </AppFooter>
    </div>
  );
}
