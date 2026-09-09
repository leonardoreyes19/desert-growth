import type { GhlContact, GhlConversation, GhlOpportunity, GhlPipeline } from "./ghl";

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

export function leadsOverTime(contacts: GhlContact[], days = 30): DayCount[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of contacts) {
    const key = new Date(c.dateAdded).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
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

export type ConversionSummary = {
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number;
};

export function conversionSummary(opportunities: GhlOpportunity[], pipelines: GhlPipeline[]): ConversionSummary {
  const { stageIdToName } = buildStageMaps(pipelines);

  function isWon(o: GhlOpportunity) {
    return o.status === "won" || WON_STAGE_RE.test(stageIdToName.get(o.pipelineStageId) || "");
  }
  function isLost(o: GhlOpportunity) {
    return o.status === "lost" || LOST_STAGE_RE.test(stageIdToName.get(o.pipelineStageId) || "");
  }

  const total = opportunities.length;
  const won = opportunities.filter(isWon).length;
  const lost = opportunities.filter(isLost).length;
  const open = total - won - lost;
  const closed = won + lost;
  return { total, won, lost, open, winRate: closed > 0 ? won / closed : 0 };
}

export type ResponseTimeSummary = {
  medianMinutes: number | null;
  avgMinutes: number | null;
  sampleSize: number;
  under5min: number;
  under1hour: number;
  overADay: number;
};

export function firstTouchResponseTime(contacts: GhlContact[], conversations: GhlConversation[]): ResponseTimeSummary {
  const firstConversationByContact = new Map<string, number>();
  for (const conv of conversations) {
    const existing = firstConversationByContact.get(conv.contactId);
    if (existing === undefined || conv.dateAdded < existing) {
      firstConversationByContact.set(conv.contactId, conv.dateAdded);
    }
  }

  const deltasMinutes: number[] = [];
  for (const c of contacts) {
    const firstConvAt = firstConversationByContact.get(c.id);
    if (firstConvAt === undefined) continue;
    const contactAt = new Date(c.dateAdded).getTime();
    const deltaMs = firstConvAt - contactAt;
    if (deltaMs < 0) continue;
    deltasMinutes.push(deltaMs / 60000);
  }

  if (deltasMinutes.length === 0) {
    return { medianMinutes: null, avgMinutes: null, sampleSize: 0, under5min: 0, under1hour: 0, overADay: 0 };
  }

  const sorted = [...deltasMinutes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const avg = deltasMinutes.reduce((s, v) => s + v, 0) / deltasMinutes.length;

  return {
    medianMinutes: median,
    avgMinutes: avg,
    sampleSize: deltasMinutes.length,
    under5min: deltasMinutes.filter((v) => v <= 5).length,
    under1hour: deltasMinutes.filter((v) => v <= 60).length,
    overADay: deltasMinutes.filter((v) => v > 1440).length,
  };
}

export type StalledSummary = {
  thresholdDays: number;
  stalledCount: number;
  openCount: number;
  oldestDays: number | null;
};

export function stalledOpenOpportunities(
  opportunities: GhlOpportunity[],
  pipelines: GhlPipeline[],
  thresholdDays = 14
): StalledSummary {
  const { stageIdToName } = buildStageMaps(pipelines);
  const isClosed = (o: GhlOpportunity) =>
    o.status === "won" ||
    o.status === "lost" ||
    WON_STAGE_RE.test(stageIdToName.get(o.pipelineStageId) || "") ||
    LOST_STAGE_RE.test(stageIdToName.get(o.pipelineStageId) || "");

  const open = opportunities.filter((o) => !isClosed(o));
  const now = Date.now();
  let stalledCount = 0;
  let oldestDays: number | null = null;

  for (const o of open) {
    const changedAt = new Date(o.lastStageChangeAt).getTime();
    const ageDays = (now - changedAt) / 86_400_000;
    if (ageDays >= thresholdDays) stalledCount++;
    if (oldestDays === null || ageDays > oldestDays) oldestDays = ageDays;
  }

  return { thresholdDays, stalledCount, openCount: open.length, oldestDays };
}

export type WeekOverWeek = {
  thisWeek: number;
  lastWeek: number;
  deltaPct: number | null;
};

export function leadsWeekOverWeek(contacts: GhlContact[]): WeekOverWeek {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const thisWeekStart = now - 7 * oneDay;
  const lastWeekStart = now - 14 * oneDay;

  let thisWeek = 0;
  let lastWeek = 0;
  for (const c of contacts) {
    const t = new Date(c.dateAdded).getTime();
    if (t >= thisWeekStart) thisWeek++;
    else if (t >= lastWeekStart) lastWeek++;
  }

  const deltaPct = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : null;
  return { thisWeek, lastWeek, deltaPct };
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Sin datos";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / 1440).toFixed(1)} días`;
}
