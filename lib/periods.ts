import { hermosilloDate, startOfMonth, startOfWeek } from "./metrics";

/**
 * Reporting window. Resumen offers Semana / Mes; Dinero and Leads also offer
 * Todo (since the first lead). Mes can be the current month or any past one
 * (?periodo=mes&mes=2026-09).
 */
export type SummaryPeriod = "semana" | "mes";
export type PeriodKey = SummaryPeriod | "todo";

export const SUMMARY_PERIODS: SummaryPeriod[] = ["semana", "mes"];
export const TAB_PERIODS: PeriodKey[] = ["semana", "mes", "todo"];
export const DEFAULT_PERIOD: SummaryPeriod = "mes";
export const DEFAULT_TAB_PERIOD: PeriodKey = "mes";

/** First month with data (the first opportunity is from 2026-06-26); the month picker starts here. */
export const FIRST_MONTH = "2026-06";

export function isSummaryPeriod(v: string | undefined | null): v is SummaryPeriod {
  return v === "semana" || v === "mes";
}

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return isSummaryPeriod(v) || v === "todo";
}

export type PeriodRange = {
  key: PeriodKey;
  /** Start of the period (Hermosillo midnight), as a UTC timestamp. */
  start: number;
  /** End of the period (exclusive); Infinity while it's still running. */
  end: number;
  /** Start of the previous period of the same kind. */
  prevStart: number;
  /**
   * End (exclusive) of the window it's compared with: the previous period cut
   * at the same elapsed point while this one is running, or the whole
   * previous period once this one has ended.
   */
  prevSamePoint: number;
  /** YYYY-MM for Mes. */
  month: string | null;
  /** A month that has already ended. */
  isPast: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const monthKey = (t: number) => hermosilloDate(t).slice(0, 7);

/** Months that can be picked, newest first: the current one back to FIRST_MONTH. */
export function monthOptions(now = Date.now()): string[] {
  const months: string[] = [];
  for (let back = 0; ; back++) {
    const key = monthKey(startOfMonth(now, back));
    if (key < FIRST_MONTH) break;
    months.push(key);
  }
  return months;
}

/**
 * Semana: since Monday. Mes: the given month (current by default). Todo:
 * everything (start 0). A running period compares against the previous one
 * up to the same point; a finished month against the whole month before.
 */
export function periodRange(key: PeriodKey, month: string | null = null, now = Date.now()): PeriodRange {
  if (key === "todo") return { key, start: 0, end: Infinity, prevStart: 0, prevSamePoint: 0, month: null, isPast: false };
  if (key === "semana") {
    const start = startOfWeek(now);
    return { key, start, end: Infinity, prevStart: start - WEEK_MS, prevSamePoint: now - WEEK_MS, month: null, isPast: false };
  }

  const current = startOfMonth(now);
  const valid = month !== null && /^\d{4}-\d{2}$/.test(month) && month >= FIRST_MONTH && month < monthKey(current);
  if (!valid) {
    const prevStart = startOfMonth(now, 1);
    return {
      key,
      start: current,
      end: Infinity,
      prevStart,
      prevSamePoint: Math.min(prevStart + (now - current), current),
      month: monthKey(current),
      isPast: false,
    };
  }
  // Mid-month of the requested month → that month's start, the next one's, and the previous one's.
  const [y, m] = month.split("-").map(Number);
  const mid = Date.UTC(y, m - 1, 15);
  const start = startOfMonth(mid);
  const end = startOfMonth(mid + 31 * DAY_MS);
  return { key, start, end, prevStart: startOfMonth(mid, 1), prevSamePoint: start, month, isPast: true };
}

/** Reads ?periodo= and ?mes= into a range, falling back to `fallback` for unknown or disallowed periods. */
export function periodFromParams<P extends PeriodKey>(
  params: { periodo?: string; mes?: string },
  allowed: readonly P[],
  fallback: P
): PeriodRange & { key: P } {
  const key = (allowed as readonly string[]).includes(params.periodo ?? "") ? (params.periodo as P) : fallback;
  return periodRange(key, params.mes ?? null) as PeriodRange & { key: P };
}

/** Hermosillo calendar dates (YYYY-MM-DD, inclusive) bounding the period and its comparison window. */
export function periodDates(range: PeriodRange, now = Date.now()) {
  return {
    since: hermosilloDate(range.start),
    until: hermosilloDate(Math.min(now, range.end - 1)),
    prevSince: hermosilloDate(range.prevStart),
    prevUntil: hermosilloDate(range.prevSamePoint - 1),
  };
}

/** What the client needs to label the period and offer the month picker. */
export type PeriodInfo = {
  key: PeriodKey;
  month: string | null;
  isPast: boolean;
  startIso: string;
  /** Only for a finished month. */
  endIso: string | null;
  prevStartIso: string;
  /** Pickable months, newest first. */
  months: string[];
};

export function periodInfo(range: PeriodRange): PeriodInfo {
  return {
    key: range.key,
    month: range.month,
    isPast: range.isPast,
    startIso: new Date(range.start).toISOString(),
    endIso: range.isPast ? new Date(range.end).toISOString() : null,
    prevStartIso: new Date(range.prevStart).toISOString(),
    months: monthOptions(),
  };
}
