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
  RESPONSE_TRACKING_SINCE,
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
import type { LeadRow } from "./leads";

/**
 * The daily email (like Zoho's daily report), sent Monday to Friday: the month
 * to date as of the end of yesterday, plus what happened since the last report
 * (yesterday; Friday to Sunday on Mondays). When a month has just ended it's
 * that month, complete. Comparisons are against the previous month up to the
 * same day (or the whole previous month once it has closed).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const STALLED_DAYS = 14;
const NOT_STALLABLE_RE = /cotizaci/i;

export type Compared = { value: number; previous: number | null };

export type DayRow = { date: string; leads: number; quotes: number; quotedValue: number; sales: number; salesValue: number; spend: number | null };

export type LeadLine = {
  name: string;
  phone: string | null;
  line: string;
  customerType: string | null;
  ad: string | null;
  stage: string | null;
  value: number;
  /** Minutes to the first human reply; null if none yet. */
  replyMinutes: number | null;
  daysInStage: number | null;
  arrived: string;
};

export type Move = { name: string; from: string; to: string; value: number; outcome: "won" | "lost" | "open" };

export type DailyReportData = {
  /** First instant after the cut (today 00:00 Hermosillo). */
  cutIso: string;
  /** The day the numbers run through (yesterday), YYYY-MM-DD. */
  cutDate: string;
  monthStartIso: string;
  prevMonthStartIso: string;
  /** The month just ended (sent on the 1st). */
  monthClosed: boolean;
  /** Start of the "since the last report" window: yesterday, or Friday on Mondays. */
  recentStartIso: string;
  /** Days in that window (1, or 3 on Mondays). */
  recentDays: number;
  /** The window is exactly the day before the email goes out. */
  recentIsYesterday: boolean;
  /** What happened since the last report. */
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
  /** One row per day of the month so far, plus the same totals for the comparison window. */
  days: DayRow[];
  prevTotals: { leads: number; quotes: number; sales: number; salesValue: number; spend: number };
  /** Leads that arrived yesterday. */
  arrivedYesterday: LeadLine[];
  /** Deals that changed stage yesterday. */
  movesYesterday: Move[];
  /** What to act on today. */
  todo: { noReply: LeadLine[]; noOpportunity: LeadLine[]; staleQuotes: LeadLine[] };
  metaError: string | null;
};

const LINE_LABEL: Record<string, string> = { golf: "Golf", marine: "Marinas", other: "Otra" };
const TRACKING_SINCE = Date.parse(RESPONSE_TRACKING_SINCE);
const RECENT_MS = 30 * DAY_MS;
const isTestContact = (r: LeadRow) => /prueba|test/i.test(r.name) || /@malpa\.com\.mx$/i.test(r.email ?? "");

function leadLine(r: LeadRow): LeadLine {
  return {
    name: r.name,
    phone: r.phone,
    line: r.stage === null ? "" : (LINE_LABEL[r.line] ?? r.line),
    customerType: r.useCase[0] ?? null,
    ad: r.adName,
    stage: r.stage,
    value: r.value,
    replyMinutes: r.firstResponseMinutes,
    daysInStage: r.daysInStage,
    arrived: r.dateAdded,
  };
}

export async function buildDailyReport(now = Date.now()): Promise<DailyReportData> {
  const locationId = requireLocationId();
  const today = startOfDay(now);
  // No emails on weekends, so Monday's covers Friday to Sunday.
  const isMonday = new Date(today + 12 * 60 * 60 * 1000).getUTCDay() === 1;
  const yesterdayStart = today - (isMonday ? 3 : 1) * DAY_MS;
  // If a month ended over the weekend, Monday's email is that month's close (cut at the 1st).
  const monthTurned = startOfMonth(today - 1) > yesterdayStart && startOfMonth(today - 1) < today;
  const end = monthTurned ? startOfMonth(today - 1) : today;
  const monthStart = startOfMonth(end - 1);
  const prevStart = startOfMonth(end - 1, 1);
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

  // Day by day: what happened on each day of the month so far.
  const inRange = (iso: string | null, from: number, to: number) => iso !== null && Date.parse(iso) >= from && Date.parse(iso) < to;
  const leadsWithOpp = data.allRows.filter((r) => r.stage !== null);
  const days: DayRow[] = [];
  for (let t = monthStart; t < end; t += DAY_MS) {
    const date = hermosilloDate(t);
    const quoted = leadsWithOpp.filter((r) => inRange(r.quotedAt, t, t + DAY_MS));
    const sold = leadsWithOpp.filter((r) => r.bucket === "won" && inRange(r.closedAt, t, t + DAY_MS));
    days.push({
      date,
      leads: contactsBetween(contacts, t, t + DAY_MS).length,
      quotes: quoted.length,
      quotedValue: quoted.reduce((s, r) => s + r.value, 0),
      sales: sold.length,
      salesValue: sold.reduce((s, r) => s + r.value, 0),
      spend: metaOk ? (metaOk.byDay.find((d) => d.date === date)?.spend ?? 0) : null,
    });
  }

  // Yesterday: who arrived and what moved in the pipeline.
  const arrivedYesterday = data.allRows
    .filter((r) => inRange(r.dateAdded, yesterdayStart, end))
    .sort((a, b) => a.dateAdded.localeCompare(b.dateAdded))
    .map(leadLine);
  const movesYesterday: Move[] = [];
  for (const r of leadsWithOpp) {
    const before = stateAt(r.events, yesterdayStart);
    const after = stateAt(r.events, end);
    if (!after) continue;
    const isNew = !before && /lead nuevo/i.test(after.stage);
    if (isNew || (before && before.stage === after.stage && before.outcome === after.outcome)) continue;
    // Marked won/lost without moving to the Ganado/Perdido stage: say so instead of "X → X".
    const sameStage = before?.stage === after.stage;
    const to =
      sameStage && after.outcome === "lost" ? `${after.stage} (marcado como perdido)`
      : sameStage && after.outcome === "won" ? `${after.stage} (marcado como ganado)`
      : sameStage && before?.outcome !== "open" ? `${after.stage} (reabierto)`
      : after.stage;
    movesYesterday.push({ name: r.name, from: before?.stage ?? "Nuevo", to, value: r.value, outcome: after.outcome });
  }
  movesYesterday.sort((a, b) => (a.outcome === b.outcome ? b.value - a.value : a.outcome === "won" ? -1 : b.outcome === "won" ? 1 : 0));

  // To do today.
  const recent = (r: LeadRow) => Date.parse(r.dateAdded) >= Math.max(end - RECENT_MS, TRACKING_SINCE) && !isTestContact(r);
  const closed = (r: LeadRow) => r.bucket === "won" || r.bucket === "lost" || r.bucket === "disqualified";
  const noReply = data.allRows
    .filter((r) => recent(r) && Date.parse(r.dateAdded) < end - DAY_MS && r.firstResponseMinutes === null && !closed(r))
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .map(leadLine);
  // Unanswered ones already appear above (flagged as missing from the pipeline), so list only the rest.
  const noOpportunity = data.allRows
    .filter((r) => recent(r) && r.stage === null && r.firstResponseMinutes !== null)
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .map(leadLine);
  const staleQuotes = leadsWithOpp
    .filter((r) => (r.bucket === "quoted" || r.bucket === "negotiation") && (r.daysInStage ?? 0) >= STALLED_DAYS)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(leadLine);

  return {
    cutIso: new Date(end).toISOString(),
    cutDate: hermosilloDate(end - 1),
    monthStartIso: new Date(monthStart).toISOString(),
    prevMonthStartIso: new Date(prevStart).toISOString(),
    monthClosed,
    recentStartIso: new Date(yesterdayStart).toISOString(),
    recentDays: Math.round((end - yesterdayStart) / DAY_MS),
    recentIsYesterday: yesterdayStart === today - DAY_MS && end === today,
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
    days,
    prevTotals: {
      leads: leadsInPeriod(contacts, range).lastWeek,
      quotes: prevFinance.quotes,
      sales: prevFinance.won,
      salesValue: prevFinance.wonValue,
      spend: prevFinance.spend,
    },
    arrivedYesterday,
    movesYesterday,
    todo: { noReply, noOpportunity, staleQuotes },
    metaError: data.metaError ?? (meta.configured && meta.error !== undefined ? meta.error : null),
  };
}
