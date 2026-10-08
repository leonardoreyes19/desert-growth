"use client";

import type { FinanceSummary, LineFinance } from "@/lib/finance";
import type { Lang } from "@/lib/i18n";
import type { ProductLine } from "@/lib/leads";
import { AppHeader, usePrefs, type Theme } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { Funnel } from "@/components/Funnel";
import { Panel, Td, Th } from "@/components/Panel";
import { SectionLabel } from "@/components/SectionLabel";
import { PeriodBar, usePeriodSwitch } from "@/components/PeriodFilter";
import { DEFAULT_TAB_PERIOD, TAB_PERIODS, type PeriodInfo } from "@/lib/periods";

export type MoneyViewProps = {
  companyName: string;
  generatedAtIso: string;
  currency: string;
  periodInfo: PeriodInfo;
  finance: FinanceSummary;
  metaConfigured: boolean;
  metaError: string | null;
  initialLang: Lang;
  initialTheme: Theme;
};

export function MoneyView(props: MoneyViewProps) {
  const { companyName, generatedAtIso, currency, periodInfo: info, finance, metaConfigured, metaError, initialLang, initialTheme } =
    props;
  const prefs = usePrefs(initialLang, initialTheme);
  const { t, locale } = prefs;
  const periodSwitch = usePeriodSwitch({ period: info.key, month: info.month }, DEFAULT_TAB_PERIOD, info.months[0] ?? null);

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const money2 = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const moneyOrDash = (n: number | null) => (n == null ? t.noValue : money(n));
  const pct = (n: number | null) => (n == null ? t.noValue : `${Math.round(n * 100)}%`);
  const count = (n: number) => n.toLocaleString(locale);
  const roasText = (n: number | null) => (n == null ? t.noValue : `${n.toLocaleString(locale, { maximumFractionDigits: 1 })}x`);

  const tot = finance.totals;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: "medium", timeZone: "America/Hermosillo" });
  const subtitle =
    info.key === "todo"
      ? t.moneySubtitle(finance.firstCampaignDate ? dateLabel(finance.firstCampaignDate) : t.noValue)
      : info.isPast
        ? t.moneyMonthSubtitle(new Date(info.startIso).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "America/Hermosillo" }))
        : t.moneyPeriodSubtitle(dateLabel(info.startIso));
  const wastedShare = tot.spend > 0 ? tot.wastedSpend / tot.spend : null;
  const chartLabels = { viewTable: t.viewTable, viewChart: t.viewChart, category: t.category, value: t.value, empty: t.noDataInPeriod };

  const lines = (["golf", "marine", "other"] as ProductLine[]).filter((l) => finance.byLine[l]);
  const lineRows: { label: string; get: (l: LineFinance) => string }[] = [
    { label: t.invested, get: (l) => money(l.spend) },
    { label: t.leadsCountCol, get: (l) => count(l.leads) },
    { label: t.cplReal, get: (l) => moneyOrDash(l.cpl) },
    // Quotes and arrivals in a period are different leads, so their ratio only makes sense for Todo.
    ...(info.key === "todo" ? [{ label: t.quoteRate, get: (l: LineFinance) => pct(l.quoteRate) }] : []),
    { label: t.costPerQuote, get: (l) => moneyOrDash(l.costPerQuote) },
    { label: t.avgQuote, get: (l) => moneyOrDash(l.avgQuote) },
    { label: t.quotedOpen, get: (l) => money(l.openQuotedValue) },
    { label: t.funnelWon, get: (l) => count(l.won) },
    { label: t.revenueWon, get: (l) => money(l.wonValue) },
    { label: t.cac, get: (l) => moneyOrDash(l.cac) },
    { label: t.roas, get: (l) => roasText(l.roas) },
    { label: t.wastedSpend, get: (l) => money(l.wastedSpend) },
  ];

  // With a period the steps are that period's events (not one group of leads narrowing down).
  const periodMode = info.key !== "todo";
  const funnelLabels = periodMode
    ? {
        leads: { label: t.periodArrivedLeads },
        answered: { label: t.periodAnswered, hint: t.periodAnsweredHint },
        quoted: { label: t.periodQuotes },
        won: { label: t.periodSales },
      }
    : {
        leads: { label: t.funnelLeads },
        answered: { label: t.funnelAnswered, hint: t.funnelAnsweredHint },
        quoted: { label: t.funnelQuoted },
        won: { label: t.funnelWon },
      };

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: "var(--page-plane)" }}>
      <AppHeader companyName={companyName} title={t.moneyTitle} subtitle={subtitle} generatedAtIso={generatedAtIso} prefs={prefs} />
      <main
        className="max-w-6xl mx-auto w-full px-4 sm:px-10 py-8 flex flex-col gap-10 flex-1 transition-opacity"
        style={{ opacity: periodSwitch.pending ? 0.55 : 1, cursor: periodSwitch.pending ? "progress" : undefined }}
        aria-busy={periodSwitch.pending}
      >
        <PeriodBar
          periods={TAB_PERIODS}
          selected={periodSwitch.shown}
          onChange={periodSwitch.change}
          info={info}
          t={t}
          locale={locale}
          note={info.key !== "todo" ? t.cohortNote : undefined}
        />

        {(!metaConfigured || metaError) && (
          <div
            className="rounded-2xl p-5 text-sm"
            style={{ background: "var(--surface-1)", border: "1px solid var(--status-warning)", color: "var(--text-secondary)" }}
          >
            {metaError ? t.moneyMetaError(metaError) : t.moneyNeedsMeta}
          </div>
        )}

        <section>
          <SectionLabel>{t.bigPicture}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon="megaphone" label={t.invested} value={money(tot.spend)} sublabel={t.investedSub(tot.paidLeads)} note={t.notes.invested} />
            <StatTile icon="trophy" label={t.revenueWon} value={money(tot.wonValue)} sublabel={t.revenueWonSub(tot.won)} accent="good" note={t.notes.revenueWon} />
            <StatTile
              icon="trendUp"
              label={t.roas}
              note={t.notes.roas}
              value={roasText(tot.roas)}
              sublabel={tot.roas != null ? t.roasSub(money2(tot.roas)) : undefined}
              accent={tot.roas == null ? "neutral" : tot.roas >= 1 ? "good" : "warning"}
            />
            <StatTile icon="fileText" label={t.quotedOpen} value={money(tot.openQuotedValue)} sublabel={t.quotedOpenSub(tot.openQuotes)} note={t.notes.quotedOpen} />
          </div>
        </section>

        <section>
          <SectionLabel>{t.unitCosts}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon="users" label={t.cplReal} value={moneyOrDash(tot.cpl)} sublabel={t.cplRealSub} note={t.notes.cpl} />
            <StatTile icon="receipt" label={t.costPerQuote} value={moneyOrDash(tot.costPerQuote)} sublabel={t.costPerQuoteSub(tot.quotes)} note={t.notes.costPerQuote} />
            <StatTile icon="target" label={t.cac} value={moneyOrDash(tot.cac)} sublabel={t.cacSub(tot.won)} note={t.notes.cac} />
            <StatTile icon="tag" label={t.avgQuote} value={moneyOrDash(tot.avgQuote)} sublabel={t.avgQuoteSub} note={t.notes.avgQuote} />
          </div>
        </section>

        <section>
          <SectionLabel>{t.lostMoney}</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              icon="alert"
              label={t.wastedSpend}
              note={t.notes.wasted}
              value={money(tot.wastedSpend)}
              sublabel={
                info.key !== "todo" ? t.wastedSpendPeriodSub(tot.wastedLeads) : wastedShare != null ? t.wastedSpendSub(pct(wastedShare)) : undefined
              }
              accent={tot.wastedSpend > 0 ? "warning" : "neutral"}
            />
            <StatTile
              icon="hourglass"
              label={t.atRisk}
              note={t.notes.atRisk}
              value={money(finance.atRisk.value)}
              sublabel={t.atRiskSub(finance.atRisk.count, finance.atRisk.thresholdDays)}
              accent={finance.atRisk.count > 0 ? "warning" : "good"}
            />
            <StatTile icon="xCircle" label={t.lostValue} value={money(tot.lostValue)} sublabel={t.lostValueSub} note={t.notes.lostValue} />
          </div>
          <div className="mt-4">
            <Panel title={t.whereSpendGoes} note={t.notes.whereSpendGoes}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-secondary)" }}>
                    <Th align="left">{t.stageCol}</Th>
                    <Th>{t.leadsCountCol}</Th>
                    <Th>{t.costCol}</Th>
                    <Th>{t.valueCol}</Th>
                  </tr>
                </thead>
                <tbody>
                  {finance.byBucket.map((b) => (
                    <tr key={b.bucket} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <Td align="left" strong>
                        <span className="inline-flex items-center gap-2">
                          {b.dead && (
                            <span
                              aria-hidden
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: "var(--status-warning)" }}
                            />
                          )}
                          {t.bucket[b.bucket]}
                        </span>
                      </Td>
                      <Td>{count(b.count)}</Td>
                      <Td strong={b.dead}>{money(b.cost)}</Td>
                      <Td>{b.value > 0 ? money(b.value) : t.noValue}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </section>

        <section>
          <SectionLabel>{periodMode ? t.periodActivityTitle : t.funnelTitle}</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            <Funnel
              title={periodMode ? t.periodActivityTitle : t.funnelTitle}
              note={periodMode ? t.notes.activity : t.notes.funnel}
              steps={finance.funnel.map((s) => ({
                ...funnelLabels[s.key],
                count: s.count,
                valueLabel: s.value > 0 ? money(s.value) : undefined,
              }))}
              formatCount={count}
              ofPrevious={periodMode ? undefined : t.funnelOfPrev}
            />
            <BarChart
              title={t.valueByStage}
              note={t.notes.valueByStage}
              data={finance.valueByStage.map((s) => ({ label: s.label, value: Math.round(s.value) }))}
              formatValue={money}
              labels={chartLabels}
            />
          </div>
        </section>

        {lines.length > 1 && (
          <section>
            <SectionLabel>{t.byLineTitle}</SectionLabel>
            <Panel note={t.notes.lineTable}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-secondary)" }}>
                    <Th align="left">{t.metricCol}</Th>
                    {lines.map((l) => (
                      <Th key={l}>{t.line[l]}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineRows.map((row) => (
                    <tr key={row.label} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <Td align="left">{row.label}</Td>
                      {lines.map((l) => (
                        <Td key={l} strong>
                          {row.get(finance.byLine[l]!)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}

        {finance.byAd.length > 0 && (
          <section>
            <SectionLabel>{t.byAdTitle}</SectionLabel>
            <Panel subtitle={t.byAdSubtitle} note={t.notes.byAd}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-secondary)" }}>
                    <Th align="left">{t.adCol}</Th>
                    <Th>{t.adSpendCol}</Th>
                    <Th>{t.leadsCountCol}</Th>
                    <Th>{t.adCplCol}</Th>
                    <Th>{t.quotesCol}</Th>
                    <Th>{t.quotedValueCol}</Th>
                    <Th>{t.wonCol}</Th>
                    <Th>{t.revenueCol}</Th>
                  </tr>
                </thead>
                <tbody>
                  {finance.byAd.map((a) => (
                    <tr key={a.adId} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <Td align="left" strong>
                        <span className="block max-w-[260px] truncate" title={a.adName}>
                          {a.adName}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t.line[a.line]}
                        </span>
                      </Td>
                      <Td>{money(a.spend)}</Td>
                      <Td>{count(a.leads)}</Td>
                      <Td strong>{moneyOrDash(a.cpl)}</Td>
                      <Td>{count(a.quotes)}</Td>
                      <Td>{money(a.quotedValue)}</Td>
                      <Td>{count(a.won)}</Td>
                      <Td strong>{money(a.wonValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}

        <section>
          <SectionLabel>{t.byUseCaseTitle}</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
            <Panel subtitle={t.byUseCaseSubtitle}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-secondary)" }}>
                    <Th align="left">{t.segmentCol}</Th>
                    <Th>{t.leadsCountCol}</Th>
                    <Th>{t.quotesCol}</Th>
                    <Th>{t.quotedValueCol}</Th>
                    <Th>{t.wonCol}</Th>
                    <Th>{t.revenueCol}</Th>
                  </tr>
                </thead>
                <tbody>
                  {finance.byUseCase.map((s) => (
                    <tr key={s.label} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <Td align="left" strong>
                        {s.label}
                      </Td>
                      <Td>{count(s.leads)}</Td>
                      <Td>{count(s.quotes)}</Td>
                      <Td strong>{money(s.quotedValue)}</Td>
                      <Td>{count(s.won)}</Td>
                      <Td>{money(s.wonValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <StatTile
              icon="battery"
              label={t.batteries}
              note={t.notes.batteries}
              value={count(finance.batteriesRequested)}
              sublabel={t.batteriesSub(count(finance.batteriesQuoted))}
            />
          </div>
        </section>

      </main>
      <AppFooter t={t}>
        <p>{t.moneyFootnote}</p>
      </AppFooter>
    </div>
  );
}
