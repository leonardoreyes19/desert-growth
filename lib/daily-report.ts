import "server-only";
import { getAllContacts, getAllMessages } from "./ghl";
import { loadLeadData, requireLocationId } from "./data";
import { financeSummary } from "./finance";
import { getMetaInsights } from "./meta";
import {
  contactsBetween,
  excludeBulkImports,
  firstTouchResponseTime,
  hermosilloDate,
  leadsInPeriod,
  snapshotFromStages,
  startOfDay,
  startOfMonth,
  type PipelineSnapshot,
  type WeekOverWeek,
} from "./metrics";
import { refreshOpportunityEvents } from "./opportunity-history";
import { stateAt } from "./opportunity-state";
import { periodDates, type PeriodRange } from "./periods";
import { pipelineHistoryFor } from "./snapshots";

/**
 * The daily email (like Zoho's daily report): the month to date as of the end
 * of yesterday, plus what happened yesterday. On the 1st it's the month that
 * just closed, complete. Comparisons are against the previous month up to the
 * same day (or the whole previous month on the 1st).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const STALLED_DAYS = 14;
const NOT_STALLABLE_RE = /cotizaci/i;

export type Compared = { value: number; previous: number | null };

export type DailyReportData = {
  /** First instant after the cut (today 00:00 Hermosillo). */
  cutIso: string;
  /** The day the numbers run through (yesterday), YYYY-MM-DD. */
  cutDate: string;
  monthStartIso: string;
  prevMonthStartIso: string;
  /** The month just ended (sent on the 1st). */
  monthClosed: boolean;
  yesterday: { newLeads: number; quotes: number; quotedValue: number; sales: number; salesValue: number };
  month: {
    newLeads: WeekOverWeek;
    quotes: Compared;
    quotedValue: number;
    sales: Compared;
    salesValue: Compared;
    closeRate: number | null;
    spend: Compared;
    cpl: number | null;
    roas: number | null;
    metaLeads: number | null;
  };
  pipeline: { now: PipelineSnapshot; prevMonthClose: PipelineSnapshot | null; stalled: number };
  response: { avgMinutes: number | null; repliedCount: number; settledCount: number; noReplyIn24h: number };
  metaError: string | null;
};

export async function buildDailyReport(now = Date.now()): Promise<DailyReportData> {
  const locationId = requireLocationId();
  const end = startOfDay(now);
  const yesterdayStart = end - DAY_MS;
  const monthStart = startOfMonth(yesterdayStart);
  const prevStart = startOfMonth(yesterdayStart, 1);
  const prevSamePoint = Math.min(prevStart + (end - monthStart), monthStart);
  const monthClosed = end === startOfMonth(end);
  const range: PeriodRange = {
    key: "mes",
    start: monthStart,
    end,
    prevStart,
    prevSamePoint,
    month: hermosilloDate(monthStart).slice(0, 7),
    isPast: true,
  };
  const prevRange: PeriodRange = { ...range, start: prevStart, end: prevSamePoint };

  // Bring the stage history up to the cut before reading it (the nightly refresh runs before midnight).
  await refreshOpportunityEvents().catch((err) => console.error("Refreshing opportunity history failed", err));

  const [contactsRaw, messages, data, prevData, meta, history] = await Promise.all([
    getAllContacts(locationId),
    getAllMessages(locationId),
    loadLeadData(range),
    loadLeadData(prevRange),
    getMetaInsights(periodDates(range, now)),
    pipelineHistoryFor(range),
  ]);
  const contacts = excludeBulkImports(contactsRaw);

  const window = { start: monthStart, end };
  const finance = financeSummary(data.allRows, data.arrivals, data.adSpend, window).totals;
  const prevFinance = financeSummary(prevData.allRows, prevData.arrivals, prevData.adSpend, {
    start: prevStart,
    end: prevSamePoint,
  }).totals;

  const inYesterday = (iso: string | null) => iso !== null && Date.parse(iso) >= yesterdayStart && Date.parse(iso) < end;
  const quotedYesterday = data.allRows.filter((r) => r.stage !== null && inYesterday(r.quotedAt));
  const soldYesterday = data.allRows.filter((r) => r.bucket === "won" && inYesterday(r.closedAt));

  // Pipeline as it stood at the cut, from each lead's stage history (bulk round trips already dropped).
  const states = data.allRows
    .filter((r) => r.stage !== null)
    .map((r) => stateAt(r.events, end))
    .filter((s) => s !== null);
  const pipelineNow = snapshotFromStages(states.map((s) => ({ stageName: s.stage, status: s.status })));
  const stalled = states.filter(
    (s) => s.outcome === "open" && !NOT_STALLABLE_RE.test(s.stage) && (end - s.stageSince) / DAY_MS >= STALLED_DAYS
  ).length;

  const response = firstTouchResponseTime(contacts, messages, monthStart, end);
  const metaOk = meta.configured && meta.error === undefined ? meta : null;

  return {
    cutIso: new Date(end).toISOString(),
    cutDate: hermosilloDate(yesterdayStart),
    monthStartIso: new Date(monthStart).toISOString(),
    prevMonthStartIso: new Date(prevStart).toISOString(),
    monthClosed,
    yesterday: {
      newLeads: contactsBetween(contacts, yesterdayStart, end).length,
      quotes: quotedYesterday.length,
      quotedValue: quotedYesterday.reduce((s, r) => s + r.value, 0),
      sales: soldYesterday.length,
      salesValue: soldYesterday.reduce((s, r) => s + r.value, 0),
    },
    month: {
      newLeads: leadsInPeriod(contacts, range),
      quotes: { value: finance.quotes, previous: prevFinance.quotes },
      quotedValue: data.allRows.filter((r) => r.quotedAt && Date.parse(r.quotedAt) >= monthStart && Date.parse(r.quotedAt) < end).reduce((s, r) => s + r.value, 0),
      sales: { value: finance.won, previous: prevFinance.won },
      salesValue: { value: finance.wonValue, previous: prevFinance.wonValue },
      closeRate: finance.closeRate,
      spend: { value: finance.spend, previous: prevFinance.spend },
      cpl: finance.cpl,
      roas: finance.roas,
      metaLeads: metaOk ? metaOk.leads : null,
    },
    pipeline: {
      now: pipelineNow,
      prevMonthClose: history.configured ? history.previous : null,
      stalled,
    },
    response: {
      avgMinutes: response.avgMinutes,
      repliedCount: response.repliedCount,
      settledCount: response.settledCount,
      noReplyIn24h: response.noReplyIn24h,
    },
    metaError: data.metaError ?? (meta.configured && meta.error !== undefined ? meta.error : null),
  };
}
