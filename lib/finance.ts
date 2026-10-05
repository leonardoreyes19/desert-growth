import { DEAD_BUCKETS, bucketForStage, type LeadRow, type ProductLine, type StageBucket } from "./leads";
import { stateAt, type StateAt } from "./opportunity-state";
import type { MetaAdSpend } from "./meta";

export type LineFinance = {
  spend: number;
  leads: number;
  paidLeads: number;
  cpl: number | null;
  quotes: number;
  costPerQuote: number | null;
  won: number;
  wonValue: number;
  cac: number | null;
  roas: number | null;
  openQuotes: number;
  openQuotedValue: number;
  avgQuote: number | null;
  quoteRate: number | null;
  closeRate: number | null;
  wastedSpend: number;
  /** Leads behind wastedSpend. */
  wastedLeads: number;
  lostValue: number;
};

export type BucketSpend = { bucket: StageBucket; count: number; cost: number; value: number; dead: boolean };

export type AtRisk = { thresholdDays: number; count: number; value: number };

export type AdPerformance = {
  adId: string;
  adName: string;
  line: ProductLine;
  spend: number;
  leads: number;
  cpl: number | null;
  quotes: number;
  quotedValue: number;
  won: number;
  wonValue: number;
};

export type SegmentValue = { label: string; leads: number; quotes: number; quotedValue: number; won: number; wonValue: number };

export type FunnelStep = { key: "leads" | "answered" | "quoted" | "won"; count: number; value: number };

export type FinanceSummary = {
  totals: LineFinance;
  byLine: Partial<Record<ProductLine, LineFinance>>;
  funnel: FunnelStep[];
  byBucket: BucketSpend[];
  atRisk: AtRisk;
  valueByStage: { label: string; value: number; position: number }[];
  byAd: AdPerformance[];
  byUseCase: SegmentValue[];
  batteriesRequested: number;
  batteriesQuoted: number;
  firstCampaignDate: string | null;
};

/**
 * Leads that arrived in [start, end), with each one's estimated cost redone
 * for that window: what its campaign spent in the window ÷ the campaign's
 * leads that arrived in the window.
 */
export function cohortBetween(rows: LeadRow[], start: number, end: number, windowSpend: MetaAdSpend[]): LeadRow[] {
  const cohort = rows.filter((r) => {
    const t = new Date(r.dateAdded).getTime();
    return t >= start && t < end;
  });
  const spendByCampaign = new Map<string, number>();
  for (const a of windowSpend) spendByCampaign.set(a.campaignId, (spendByCampaign.get(a.campaignId) ?? 0) + a.spend);
  const leadsByCampaign = new Map<string, number>();
  for (const r of cohort) if (r.campaignId && r.stage) leadsByCampaign.set(r.campaignId, (leadsByCampaign.get(r.campaignId) ?? 0) + 1);
  return cohort.map((r) => {
    const spend = r.campaignId ? spendByCampaign.get(r.campaignId) : undefined;
    const leads = r.campaignId ? leadsByCampaign.get(r.campaignId) : undefined;
    return { ...r, estCost: spend !== undefined && leads ? spend / leads : 0 };
  });
}

/** The reporting window; Todo is (-∞, ∞). */
export type FinanceWindow = { start: number; end: number };

const ALL_TIME: FinanceWindow = { start: -Infinity, end: Infinity };
const DAY_MS = 86_400_000;
const OPEN_QUOTE_RE = /cotizaci|negociaci/i;
const NO_RESPONSE_RE = /sin respuesta/i;

const inWindow = (iso: string | null, w: FinanceWindow) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= w.start && t < w.end;
};

/** Everything that happened to the leads in a window, as sets of rows. */
type Activity = {
  /** Leads that arrived in the window (they set cost per lead). */
  arrivals: LeadRow[];
  /** Leads first quoted in the window. */
  quoted: LeadRow[];
  /** Deals won in the window, whenever the lead arrived. */
  sales: LeadRow[];
  /** Deals lost or disqualified in the window. */
  lost: LeadRow[];
  /** Leads that ended up lost or in Sin respuesta during the window (and still were at its end). */
  dead: LeadRow[];
  /** Quotes still open when the window ended, with how long they'd been in their stage. */
  openQuotes: { row: LeadRow; daysInStage: number }[];
};

function activity(allRows: LeadRow[], arrivals: LeadRow[], w: FinanceWindow, at: number): Activity {
  const leads = allRows.filter((r) => r.stage !== null);
  const states = new Map<string, StateAt | null>(leads.map((r) => [r.id, stateAt(r.events, at)]));
  const dead: LeadRow[] = [];
  const openQuotes: Activity["openQuotes"] = [];
  for (const r of leads) {
    const s = states.get(r.id);
    if (!s) continue;
    const isDead = s.outcome === "lost" || (s.outcome === "open" && NO_RESPONSE_RE.test(s.stage));
    const since = s.outcome === "lost" ? s.outcomeSince : s.stageSince;
    if (isDead && since >= w.start && since < w.end) dead.push(r);
    if (s.outcome === "open" && OPEN_QUOTE_RE.test(s.stage)) openQuotes.push({ row: r, daysInStage: (at - s.stageSince) / DAY_MS });
  }
  const closedIn = (r: LeadRow) => inWindow(r.closedAt, w) && stateAt(r.events, at)?.outcome !== "open";
  return {
    arrivals: arrivals.filter((r) => r.stage !== null),
    quoted: leads.filter((r) => inWindow(r.quotedAt, w)),
    sales: leads.filter((r) => r.bucket === "won" && closedIn(r)),
    lost: leads.filter((r) => (r.bucket === "lost" || r.bucket === "disqualified") && closedIn(r)),
    dead,
    openQuotes,
  };
}

function filterActivity(a: Activity, keep: (r: LeadRow) => boolean): Activity {
  return {
    arrivals: a.arrivals.filter(keep),
    quoted: a.quoted.filter(keep),
    sales: a.sales.filter(keep),
    lost: a.lost.filter(keep),
    dead: a.dead.filter(keep),
    openQuotes: a.openQuotes.filter((q) => keep(q.row)),
  };
}

const sum = (rs: LeadRow[]) => rs.reduce((s, r) => s + r.value, 0);

function lineFinance(a: Activity, spend: number, costOf: (r: LeadRow) => number): LineFinance {
  const paid = a.arrivals.filter((r) => r.campaignId);
  const quotesWithValue = a.quoted.filter((r) => r.value > 0);
  const wonValue = sum(a.sales);
  const closed = a.sales.length + a.lost.length;
  return {
    spend,
    leads: a.arrivals.length,
    paidLeads: paid.length,
    cpl: paid.length > 0 && spend > 0 ? spend / paid.length : null,
    quotes: a.quoted.length,
    costPerQuote: a.quoted.length > 0 && spend > 0 ? spend / a.quoted.length : null,
    won: a.sales.length,
    wonValue,
    cac: a.sales.length > 0 && spend > 0 ? spend / a.sales.length : null,
    roas: spend > 0 ? wonValue / spend : null,
    openQuotes: a.openQuotes.length,
    openQuotedValue: a.openQuotes.reduce((s, q) => s + q.row.value, 0),
    avgQuote: quotesWithValue.length > 0 ? sum(quotesWithValue) / quotesWithValue.length : null,
    quoteRate: a.arrivals.length > 0 ? a.quoted.length / a.arrivals.length : null,
    closeRate: closed > 0 ? a.sales.length / closed : null,
    wastedSpend: a.dead.reduce((s, r) => s + costOf(r), 0),
    wastedLeads: a.dead.length,
    lostValue: sum(a.lost),
  };
}

/**
 * Money view for a window: what Meta spent in it (`adSpend`), the leads that
 * arrived in it (`arrivals`, costed with that spend), and every quote, sale
 * and loss that happened in it — whenever the lead arrived. `allRows` carries
 * each lead's stage history. With no window (Todo), it's all time.
 */
export function financeSummary(
  allRows: LeadRow[],
  arrivals: LeadRow[],
  adSpend: MetaAdSpend[],
  window: FinanceWindow | null = null,
  atRiskDays = 14
): FinanceSummary {
  const w = window ?? ALL_TIME;
  const at = Math.min(Date.now(), w.end);
  const all = activity(allRows, arrivals, w, at);

  // A lead's cost: this window's cost per lead if it arrived in it, otherwise its lifetime estimate.
  const windowCost = new Map(arrivals.map((r) => [r.id, r.estCost]));
  const costOf = (r: LeadRow) => windowCost.get(r.id) ?? r.estCost;

  const spendByCampaign = new Map<string, number>();
  for (const a of adSpend) spendByCampaign.set(a.campaignId, (spendByCampaign.get(a.campaignId) ?? 0) + a.spend);

  const lines: ProductLine[] = ["golf", "marine", "other"];
  const byLine: Partial<Record<ProductLine, LineFinance>> = {};
  for (const line of lines) {
    const lineActivity = filterActivity(all, (r) => r.line === line);
    // Campaigns come from every lead of the line, so spend counts even in a window with no leads from it.
    const campaigns = new Set(
      allRows.filter((r) => r.stage !== null && r.line === line).map((r) => r.campaignId).filter((id): id is string => !!id)
    );
    const spend = [...campaigns].reduce((s, id) => s + (spendByCampaign.get(id) ?? 0), 0);
    const empty = Object.values(lineActivity).every((set) => set.length === 0);
    if (empty && spend === 0) continue;
    byLine[line] = lineFinance(lineActivity, spend, costOf);
  }
  const totalSpend = Object.values(byLine).reduce((s, l) => s + (l?.spend ?? 0), 0);

  const answered = allRows.filter((r) => r.stage !== null && inWindow(r.answeredAt, w));

  // Where the period's leads stand at the end of the window, and what they cost.
  const bucketOrder: StageBucket[] = [
    "new", "contacted", "noResponse", "quoted", "negotiation", "later", "won", "lost", "disqualified", "lithium", "other",
  ];
  const bucketAtEnd = (r: LeadRow): StageBucket => {
    const s = stateAt(r.events, at);
    return s ? bucketForStage(s.stage, s.status) : r.bucket;
  };
  const byBucket: BucketSpend[] = bucketOrder
    .map((bucket) => {
      const rs = all.arrivals.filter((r) => bucketAtEnd(r) === bucket);
      return { bucket, count: rs.length, cost: rs.reduce((s, r) => s + costOf(r), 0), value: sum(rs), dead: DEAD_BUCKETS.includes(bucket) };
    })
    .filter((b) => b.count > 0);

  const stale = all.openQuotes.filter((q) => q.daysInStage >= atRiskDays).map((q) => q.row);

  // Quoted amount by the stage each deal was in at the end of the window.
  const stagePosition = new Map<string, number>();
  for (const r of allRows) if (r.stage) stagePosition.set(r.stage, Math.min(stagePosition.get(r.stage) ?? 999, r.stagePosition));
  const stageValue = new Map<string, number>();
  for (const r of allRows) {
    if (r.value <= 0) continue;
    const stage = stateAt(r.events, at)?.stage;
    if (stage) stageValue.set(stage, (stageValue.get(stage) ?? 0) + r.value);
  }

  // Per ad and per customer type: leads that arrived, quotes and sales in the window.
  const adsById = new Map(adSpend.map((a) => [a.adId, a]));
  const adAgg = new Map<string, AdPerformance>();
  const adEntry = (r: LeadRow) => {
    const id = r.adId!;
    const existing = adAgg.get(id);
    if (existing) return existing;
    const meta = adsById.get(id);
    const created: AdPerformance = {
      adId: id,
      adName: meta?.adName ?? r.adName ?? id,
      line: r.line,
      spend: meta?.spend ?? 0,
      leads: 0,
      cpl: null,
      quotes: 0,
      quotedValue: 0,
      won: 0,
      wonValue: 0,
    };
    adAgg.set(id, created);
    return created;
  };
  for (const r of all.arrivals) if (r.adId) adEntry(r).leads++;
  for (const r of all.quoted) if (r.adId) {
    const e = adEntry(r);
    e.quotes++;
    e.quotedValue += r.value;
  }
  for (const r of all.sales) if (r.adId) {
    const e = adEntry(r);
    e.won++;
    e.wonValue += r.value;
  }
  const byAd = [...adAgg.values()]
    .map((a) => ({ ...a, cpl: a.leads > 0 && a.spend > 0 ? a.spend / a.leads : null }))
    .sort((a, b) => b.leads - a.leads || b.quotes - a.quotes);

  const useCaseAgg = new Map<string, SegmentValue>();
  const customerTypeEntries = (r: LeadRow) =>
    (r.useCase.length ? r.useCase : ["Sin dato"]).map((raw) => {
      const label = raw.trim() || "Sin dato";
      const e = useCaseAgg.get(label) ?? { label, leads: 0, quotes: 0, quotedValue: 0, won: 0, wonValue: 0 };
      useCaseAgg.set(label, e);
      return e;
    });
  for (const r of all.arrivals) for (const e of customerTypeEntries(r)) e.leads++;
  for (const r of all.quoted) for (const e of customerTypeEntries(r)) {
    e.quotes++;
    e.quotedValue += r.value;
  }
  for (const r of all.sales) for (const e of customerTypeEntries(r)) {
    e.won++;
    e.wonValue += r.value;
  }

  const paidDates = allRows.filter((r) => r.stage !== null && r.campaignId).map((r) => r.dateAdded).sort();

  return {
    totals: lineFinance(all, totalSpend, costOf),
    byLine,
    funnel: [
      { key: "leads", count: all.arrivals.length, value: 0 },
      { key: "answered", count: answered.length, value: 0 },
      { key: "quoted", count: all.quoted.length, value: sum(all.quoted) },
      { key: "won", count: all.sales.length, value: sum(all.sales) },
    ],
    byBucket,
    atRisk: { thresholdDays: atRiskDays, count: stale.length, value: sum(stale) },
    valueByStage: [...stageValue.entries()]
      .map(([label, value]) => ({ label, value, position: stagePosition.get(label) ?? 999 }))
      .sort((a, b) => a.position - b.position),
    byAd,
    byUseCase: [...useCaseAgg.values()].sort((a, b) => b.quotedValue - a.quotedValue || b.leads - a.leads),
    batteriesRequested: all.arrivals.reduce((s, r) => s + (r.batteryQty ?? 0), 0),
    batteriesQuoted: all.quoted.reduce((s, r) => s + (r.batteryQty ?? 0), 0),
    firstCampaignDate: paidDates[0] ?? null,
  };
}
