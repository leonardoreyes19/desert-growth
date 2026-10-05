import type { GhlContact, GhlMessage, GhlOpportunity, GhlPipeline } from "./ghl";

export type SourceCount = { label: string; value: number };

const OTHER_LABEL = "Otros";

function topNWithOther(counts: Map<string, number>, maxSlots: number): SourceCount[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  if (sorted.length <= maxSlots) return sorted;
  const top = sorted.slice(0, maxSlots);
  const rest = sorted.slice(maxSlots).reduce((sum, s) => sum + s.value, 0);
  return [...top, { label: OTHER_LABEL, value: rest }];
}

export function leadsBySource(contacts: GhlContact[], maxSlots = 7): SourceCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const key = (c.source || "Desconocido").trim() || "Desconocido";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return topNWithOther(counts, maxSlots);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function distinctTags(contacts: GhlContact[], maxSlots = 8): string[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    for (const rawTag of c.tags ?? []) {
      const tag = rawTag.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSlots)
    .map(([tag]) => tag);
}

export function filterContactsByTag(contacts: GhlContact[], tag: string): GhlContact[] {
  const target = tag.trim().toLowerCase();
  return contacts.filter((c) => (c.tags ?? []).some((t) => t.trim().toLowerCase() === target));
}

export function leadsByCity(contacts: GhlContact[], maxSlots = 8): SourceCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const raw = (c.city || "").trim();
    const key = raw ? toTitleCase(raw) : "Sin ciudad";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return topNWithOther(counts, maxSlots);
}

export function opportunitiesByPipeline(opportunities: GhlOpportunity[], pipelines: GhlPipeline[]): SourceCount[] {
  const pipelineIdToName = new Map(pipelines.map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const o of opportunities) {
    const key = pipelineIdToName.get(o.pipelineId) || "Sin línea de producto";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return topNWithOther(counts, 10);
}

export type DayCount = { date: string; value: number };

/** New leads per Hermosillo calendar day, from `from` through `to` (exclusive) or today, whichever is earlier. */
export function leadsOverTime(contacts: GhlContact[], from: number, to = Infinity): DayCount[] {
  const buckets = new Map<string, number>();
  const last = hermosilloDate(Math.min(Date.now(), to - 1));
  for (let t = from; hermosilloDate(t) <= last; t += ONE_DAY_MS) buckets.set(hermosilloDate(t), 0);
  for (const c of contacts) {
    const key = hermosilloDate(new Date(c.dateAdded).getTime());
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

export function contactsBetween(contacts: GhlContact[], from: number, to = Infinity): GhlContact[] {
  return contacts.filter((c) => {
    const t = new Date(c.dateAdded).getTime();
    return t >= from && t < to;
  });
}

export type StageCount = { label: string; value: number; position: number };

function buildStageMaps(pipelines: GhlPipeline[]) {
  const stageMeta = new Map<string, { name: string; position: number }>();
  const stageIdToName = new Map<string, string>();
  for (const p of pipelines) {
    for (const s of p.stages) {
      stageIdToName.set(s.id, s.name);
      const existing = stageMeta.get(s.name);
      if (!existing || existing.position > s.position) {
        stageMeta.set(s.name, { name: s.name, position: s.position });
      }
    }
  }
  return { stageMeta, stageIdToName };
}

const WON_STAGE_RE = /ganad/i;
const LOST_STAGE_RE = /perdid|descalificad/i;

export function pipelineByStage(opportunities: GhlOpportunity[], pipelines: GhlPipeline[]): StageCount[] {
  const { stageMeta, stageIdToName } = buildStageMaps(pipelines);

  const counts = new Map<string, number>();
  for (const o of opportunities) {
    const name = stageIdToName.get(o.pipelineStageId) || "Otra etapa";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, position: stageMeta.get(label)?.position ?? 999 }))
    .sort((a, b) => a.position - b.position);
}

/** Won / lost / open for one opportunity, from its stage name and status. */
export function stageOutcome(stageName: string, status: string): "won" | "lost" | "open" {
  if (status === "won" || WON_STAGE_RE.test(stageName)) return "won";
  if (status === "lost" || LOST_STAGE_RE.test(stageName)) return "lost";
  return "open";
}

function stageClassifier(pipelines: GhlPipeline[]) {
  const { stageIdToName } = buildStageMaps(pipelines);
  const stageName = (o: GhlOpportunity) => stageIdToName.get(o.pipelineStageId) || "";
  const isWon = (o: GhlOpportunity) => stageOutcome(stageName(o), o.status) === "won";
  const isLost = (o: GhlOpportunity) => stageOutcome(stageName(o), o.status) === "lost";
  return { stageName, isWon, isLost };
}

export type ConversionSummary = {
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number;
};

/**
 * A lead only counts as closed once it became a deal (Ganado) or told us no
 * (Perdido / marked lost). "Sin respuesta" and every other stage are still open.
 */
export function conversionSummary(opportunities: GhlOpportunity[], pipelines: GhlPipeline[]): ConversionSummary {
  const { isWon, isLost } = stageClassifier(pipelines);
  const total = opportunities.length;
  const won = opportunities.filter(isWon).length;
  const lost = opportunities.filter(isLost).length;
  const open = total - won - lost;
  const closed = won + lost;
  return { total, won, lost, open, winRate: closed > 0 ? won / closed : 0 };
}

export type PeriodConversion = { won: number; lost: number; winRate: number | null };

/**
 * Deals won or lost within [from, to) — dated by the opportunity's last stage
 * or status change, whichever came later (that's when it was closed).
 */
export function conversionBetween(
  opportunities: GhlOpportunity[],
  pipelines: GhlPipeline[],
  from: number,
  to: number
): PeriodConversion {
  const { isWon, isLost } = stageClassifier(pipelines);
  let won = 0;
  let lost = 0;
  for (const o of opportunities) {
    const closedAt = Math.max(new Date(o.lastStageChangeAt).getTime() || 0, new Date(o.lastStatusChangeAt).getTime() || 0);
    if (closedAt < from || closedAt >= to) continue;
    if (isWon(o)) won++;
    else if (isLost(o)) lost++;
  }
  return { won, lost, winRate: won + lost > 0 ? won / (won + lost) : null };
}

const IN_CONVERSATION_STAGE_RE = /contactad|cotizaci|negociaci/i;
const NO_RESPONSE_STAGE_RE = /sin respuesta/i;
const QUOTED_STAGE_RE = /cotizaci/i;

export type PipelineSnapshot = {
  /** Open leads we're talking to: Contactado, Cotización enviada, En negociación. */
  inConversation: number;
  /** Every lead not yet Ganado or Perdido. */
  open: number;
  noResponse: number;
};

/** Pipeline counts from each opportunity's stage name and status (shared with the history backfill). */
export function snapshotFromStages(opps: { stageName: string; status: string }[]): PipelineSnapshot {
  const open = opps.filter((o) => stageOutcome(o.stageName, o.status) === "open");
  return {
    inConversation: open.filter((o) => IN_CONVERSATION_STAGE_RE.test(o.stageName)).length,
    open: open.length,
    noResponse: open.filter((o) => NO_RESPONSE_STAGE_RE.test(o.stageName)).length,
  };
}

export function pipelineSnapshot(opportunities: GhlOpportunity[], pipelines: GhlPipeline[]): PipelineSnapshot {
  const { stageName } = stageClassifier(pipelines);
  return snapshotFromStages(opportunities.map((o) => ({ stageName: stageName(o), status: o.status })));
}

const AUTOMATED_SOURCES = new Set(["workflow", "bulk_actions", "campaign"]);

/** First message a person (not an automation) sent to each contact after it was created. */
export function firstHumanReplyByContact(contacts: GhlContact[], messages: GhlMessage[]): Map<string, number> {
  const createdAt = new Map(contacts.map((c) => [c.id, new Date(c.dateAdded).getTime()]));
  const firstReply = new Map<string, number>();
  for (const m of messages) {
    if (m.direction !== "outbound" || AUTOMATED_SOURCES.has(m.source ?? "")) continue;
    if (m.messageType.startsWith("TYPE_ACTIVITY")) continue;
    const created = createdAt.get(m.contactId);
    const sentAt = new Date(m.dateAdded).getTime();
    if (created === undefined || sentAt < created) continue;
    const existing = firstReply.get(m.contactId);
    if (existing === undefined || sentAt < existing) firstReply.set(m.contactId, sentAt);
  }
  return firstReply;
}

/**
 * Replies only show up in GHL since WhatsApp was connected on 2026-09-28;
 * before that the team answered from their phones, so older leads would all
 * look unanswered. Measure from that day on (Hermosillo time).
 */
export const RESPONSE_TRACKING_SINCE = "2026-09-28T00:00:00-07:00";

export type ResponseTimeSummary = {
  trackingSince: string;
  /** Median minutes to first human reply, over leads that got one. */
  medianMinutes: number | null;
  repliedCount: number;
  /** Leads at least 24h old — each has had a full day to be answered. The percentages below are over these. */
  settledCount: number;
  under5min: number;
  under1hour: number;
  noReplyIn24h: number;
};

/** Response speed for leads that arrived in [from, to) (never earlier than RESPONSE_TRACKING_SINCE). */
export function firstTouchResponseTime(
  contacts: GhlContact[],
  messages: GhlMessage[],
  from = 0,
  to = Infinity
): ResponseTimeSummary {
  const since = Math.max(from, new Date(RESPONSE_TRACKING_SINCE).getTime());
  const now = Date.now();
  const tracked = contactsBetween(contacts, since, to);
  const firstReply = firstHumanReplyByContact(tracked, messages);

  const replyMinutes: number[] = [];
  let settledCount = 0;
  let under5min = 0;
  let under1hour = 0;
  let noReplyIn24h = 0;
  for (const c of tracked) {
    const created = new Date(c.dateAdded).getTime();
    const reply = firstReply.get(c.id);
    const minutes = reply !== undefined ? (reply - created) / 60000 : null;
    if (minutes !== null) replyMinutes.push(minutes);
    if (now - created < 24 * 60 * 60 * 1000) continue;
    settledCount++;
    if (minutes !== null && minutes <= 5) under5min++;
    if (minutes !== null && minutes <= 60) under1hour++;
    if (minutes === null || minutes > 1440) noReplyIn24h++;
  }

  const sorted = replyMinutes.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMinutes =
    sorted.length === 0 ? null : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    trackingSince: new Date(since).toISOString(),
    medianMinutes,
    repliedCount: sorted.length,
    settledCount,
    under5min,
    under1hour,
    noReplyIn24h,
  };
}

export type StalledSummary = {
  thresholdDays: number;
  stalledCount: number;
  openCount: number;
  oldestDays: number | null;
  byStage: SourceCount[];
};

export function stalledOpenOpportunities(
  opportunities: GhlOpportunity[],
  pipelines: GhlPipeline[],
  thresholdDays = 14
): StalledSummary {
  const { stageName, isWon, isLost } = stageClassifier(pipelines);
  // A sent quote is waiting on the customer, not on us — it doesn't count as stalled.
  const open = opportunities.filter((o) => !isWon(o) && !isLost(o) && !QUOTED_STAGE_RE.test(stageName(o)));
  const now = Date.now();
  let stalledCount = 0;
  let oldestDays: number | null = null;
  const perStage = new Map<string, number>();

  for (const o of open) {
    const changedAt = new Date(o.lastStageChangeAt).getTime();
    const ageDays = (now - changedAt) / 86_400_000;
    if (ageDays >= thresholdDays) {
      stalledCount++;
      const stage = stageName(o) || "Otra etapa";
      perStage.set(stage, (perStage.get(stage) || 0) + 1);
    }
    if (oldestDays === null || ageDays > oldestDays) oldestDays = ageDays;
  }

  const byStage = [...perStage.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  return { thresholdDays, stalledCount, openCount: open.length, oldestDays, byStage };
}

export type WeekOverWeek = {
  thisWeek: number;
  lastWeek: number;
  deltaPct: number | null;
};

function countWeekOverWeek(
  contacts: GhlContact[],
  thisWeekStart: number,
  thisWeekEnd: number,
  lastWeekStart: number,
  lastWeekEnd: number
): WeekOverWeek {
  let thisWeek = 0;
  let lastWeek = 0;
  for (const c of contacts) {
    const t = new Date(c.dateAdded).getTime();
    if (t >= thisWeekStart && t < thisWeekEnd) thisWeek++;
    else if (t >= lastWeekStart && t < lastWeekEnd) lastWeek++;
  }

  const deltaPct = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : null;
  return { thisWeek, lastWeek, deltaPct };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Rolling last 7 days vs. the 7 before — used by the Monday email, which reports the week that just ended. */
export function leadsWeekOverWeek(contacts: GhlContact[]): WeekOverWeek {
  const now = Date.now();
  return countWeekOverWeek(contacts, now - 7 * ONE_DAY_MS, Infinity, now - 14 * ONE_DAY_MS, now - 7 * ONE_DAY_MS);
}

// America/Hermosillo is UTC-7 year-round (no DST).
const HERMOSILLO_OFFSET_MS = -7 * 60 * 60 * 1000;

/** Monday 00:00 (Hermosillo time) of the week containing `now`, as a UTC timestamp. */
export function startOfWeek(now: number): number {
  const local = new Date(now + HERMOSILLO_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return localMidnight - daysSinceMonday * ONE_DAY_MS - HERMOSILLO_OFFSET_MS;
}

/** The 1st at 00:00 (Hermosillo time) of the month containing `now`, `monthsBack` months earlier. */
export function startOfMonth(now: number, monthsBack = 0): number {
  const local = new Date(now + HERMOSILLO_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1) - HERMOSILLO_OFFSET_MS;
}

/** Hermosillo calendar date (YYYY-MM-DD) of a timestamp. */
export function hermosilloDate(t: number): string {
  return new Date(t + HERMOSILLO_OFFSET_MS).toISOString().slice(0, 10);
}

/** New leads in the period vs. its comparison window (previous period up to the same point, or all of it). */
export function leadsInPeriod(
  contacts: GhlContact[],
  range: { start: number; end: number; prevStart: number; prevSamePoint: number }
): WeekOverWeek {
  return countWeekOverWeek(contacts, range.start, range.end, range.prevStart, range.prevSamePoint);
}

const BULK_IMPORT_MIN_SIZE = 20;
const BULK_IMPORT_MAX_GAP_MS = 60 * 1000;

/**
 * Drops contacts created in bulk (CSV imports, the WhatsApp coexistence sync
 * that copied ~900 phone contacts into GHL on 2026-09-29). A burst is a run of
 * contacts each created within a minute of the previous one; real leads never
 * chain 20+ like that, so any such run is an import.
 */
export function excludeBulkImports(contacts: GhlContact[]): GhlContact[] {
  const sorted = [...contacts].sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  const imported = new Set<string>();
  let run: GhlContact[] = [];
  const flush = () => {
    if (run.length >= BULK_IMPORT_MIN_SIZE) for (const c of run) imported.add(c.id);
    run = [];
  };
  for (const c of sorted) {
    const prev = run[run.length - 1];
    if (prev && new Date(c.dateAdded).getTime() - new Date(prev.dateAdded).getTime() > BULK_IMPORT_MAX_GAP_MS) flush();
    run.push(c);
  }
  flush();
  return contacts.filter((c) => !imported.has(c.id));
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Sin datos";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / 1440).toFixed(1)} días`;
}
