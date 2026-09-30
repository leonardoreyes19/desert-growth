import { hermosilloDate, startOfMonth, startOfWeek } from "./metrics";

/** The Resumen's reporting window, picked with the Semana / Mes filter. */
export type PeriodKey = "semana" | "mes";

export const PERIOD_KEYS: PeriodKey[] = ["semana", "mes"];
export const DEFAULT_PERIOD: PeriodKey = "semana";

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return v === "semana" || v === "mes";
}

export type PeriodRange = {
  key: PeriodKey;
  /** Start of the current period (Hermosillo midnight), as a UTC timestamp. */
  start: number;
  /** Start of the previous period of the same kind. */
  prevStart: number;
  /** The previous period cut at the same elapsed point as today, for fair to-date comparisons. */
  prevSamePoint: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Semana: since Monday. Mes: since the 1st. Each compares against the period right before it, up to the same point. */
export function periodRange(key: PeriodKey, now = Date.now()): PeriodRange {
  if (key === "mes") {
    const start = startOfMonth(now);
    const prevStart = startOfMonth(now, 1);
    return { key, start, prevStart, prevSamePoint: Math.min(prevStart + (now - start), start) };
  }
  const start = startOfWeek(now);
  return { key, start, prevStart: start - WEEK_MS, prevSamePoint: now - WEEK_MS };
}

/** Hermosillo calendar dates (YYYY-MM-DD) bounding the period, for APIs that take dates. */
export function periodDates(range: PeriodRange, now = Date.now()) {
  return {
    since: hermosilloDate(range.start),
    until: hermosilloDate(now),
    prevSince: hermosilloDate(range.prevStart),
    prevUntil: hermosilloDate(range.prevSamePoint),
  };
}
