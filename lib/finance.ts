import { DEAD_BUCKETS, QUOTED_BUCKETS, type LeadRow, type ProductLine, type StageBucket } from "./leads";
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

const isQuoted = (r: LeadRow) => QUOTED_BUCKETS.includes(r.bucket) || (r.bucket === "lost" && r.value > 0);

function lineFinance(rows: LeadRow[], spend: number): LineFinance {
  const paid = rows.filter((r) => r.campaignId);
  const quotes = rows.filter(isQuoted);
  const won = rows.filter((r) => r.bucket === "won");
  const wonValue = won.reduce((s, r) => s + r.value, 0);
  const openQuoted = rows.filter((r) => r.bucket === "quoted" || r.bucket === "negotiation");
  const openQuotedValue = openQuoted.reduce((s, r) => s + r.value, 0);
  const closed = rows.filter((r) => r.bucket === "won" || r.bucket === "lost" || r.bucket === "disqualified").length;
  return {
    spend,
    leads: rows.length,
    paidLeads: paid.length,
    cpl: paid.length > 0 && spend > 0 ? spend / paid.length : null,
    quotes: quotes.length,
    costPerQuote: quotes.length > 0 && spend > 0 ? spend / quotes.length : null,
    won: won.length,
    wonValue,
    cac: won.length > 0 && spend > 0 ? spend / won.length : null,
    roas: spend > 0 ? wonValue / spend : null,
    openQuotes: openQuoted.length,
    openQuotedValue,
    avgQuote: quotes.filter((r) => r.value > 0).length > 0
      ? quotes.reduce((s, r) => s + r.value, 0) / quotes.filter((r) => r.value > 0).length
      : null,
    quoteRate: rows.length > 0 ? quotes.length / rows.length : null,
    closeRate: closed > 0 ? won.length / closed : null,
    wastedSpend: rows.filter((r) => DEAD_BUCKETS.includes(r.bucket)).reduce((s, r) => s + r.estCost, 0),
    lostValue: rows.filter((r) => r.bucket === "lost" || r.bucket === "disqualified").reduce((s, r) => s + r.value, 0),
  };
}

export function financeSummary(rows: LeadRow[], adSpend: MetaAdSpend[], atRiskDays = 14): FinanceSummary {
  // Only CRM opportunities count as leads here (a handful of contacts have none).
  const leads = rows.filter((r) => r.stage !== null);

  const spendByCampaign = new Map<string, number>();
  for (const a of adSpend) spendByCampaign.set(a.campaignId, (spendByCampaign.get(a.campaignId) ?? 0) + a.spend);

  const lines: ProductLine[] = ["golf", "marine", "other"];
  const byLine: Partial<Record<ProductLine, LineFinance>> = {};
  for (const line of lines) {
    const lineRows = leads.filter((r) => r.line === line);
    if (lineRows.length === 0) continue;
    const campaigns = new Set(lineRows.map((r) => r.campaignId).filter((id): id is string => !!id));
    const spend = [...campaigns].reduce((s, id) => s + (spendByCampaign.get(id) ?? 0), 0);
    byLine[line] = lineFinance(lineRows, spend);
  }
  const totalSpend = Object.values(byLine).reduce((s, l) => s + (l?.spend ?? 0), 0);

  const answered = leads.filter((r) => r.bucket !== "new" && r.bucket !== "noResponse");
  const quoted = leads.filter(isQuoted);
  const won = leads.filter((r) => r.bucket === "won");
  const sum = (rs: LeadRow[]) => rs.reduce((s, r) => s + r.value, 0);

  const bucketOrder: StageBucket[] = [
    "new", "contacted", "noResponse", "quoted", "negotiation", "won", "lost", "disqualified", "lithium", "other",
  ];
  const byBucket: BucketSpend[] = bucketOrder
    .map((bucket) => {
      const rs = leads.filter((r) => r.bucket === bucket);
      return {
        bucket,
        count: rs.length,
        cost: rs.reduce((s, r) => s + r.estCost, 0),
        value: sum(rs),
        dead: DEAD_BUCKETS.includes(bucket),
      };
    })
    .filter((b) => b.count > 0);

  const stale = leads.filter(
    (r) => (r.bucket === "quoted" || r.bucket === "negotiation") && (r.daysInStage ?? 0) >= atRiskDays
  );

  const stageValue = new Map<string, { value: number; position: number }>();
  for (const r of leads) {
    if (!r.stage || r.value <= 0) continue;
    const e = stageValue.get(r.stage) ?? { value: 0, position: r.stagePosition };
    stageValue.set(r.stage, { value: e.value + r.value, position: Math.min(e.position, r.stagePosition) });
  }

  const adAgg = new Map<string, AdPerformance>();
  const adsById = new Map(adSpend.map((a) => [a.adId, a]));
  for (const r of leads) {
    if (!r.adId) continue;
    const meta = adsById.get(r.adId);
    const e =
      adAgg.get(r.adId) ??
      {
        adId: r.adId,
        adName: meta?.adName ?? r.adId,
        line: r.line,
        spend: meta?.spend ?? 0,
        leads: 0,
        cpl: null,
        quotes: 0,
        quotedValue: 0,
        won: 0,
        wonValue: 0,
      };
    e.leads++;
    if (isQuoted(r)) {
      e.quotes++;
      e.quotedValue += r.value;
    }
    if (r.bucket === "won") {
      e.won++;
      e.wonValue += r.value;
    }
    adAgg.set(r.adId, e);
  }
  const byAd = [...adAgg.values()]
    .map((a) => ({ ...a, cpl: a.leads > 0 && a.spend > 0 ? a.spend / a.leads : null }))
    .sort((a, b) => b.leads - a.leads);

  const useCaseAgg = new Map<string, SegmentValue>();
  for (const r of leads) {
    for (const raw of r.useCase.length ? r.useCase : ["Sin dato"]) {
      const label = raw.trim() || "Sin dato";
      const e = useCaseAgg.get(label) ?? { label, leads: 0, quotes: 0, quotedValue: 0, won: 0, wonValue: 0 };
      e.leads++;
      if (isQuoted(r)) {
        e.quotes++;
        e.quotedValue += r.value;
      }
      if (r.bucket === "won") {
        e.won++;
        e.wonValue += r.value;
      }
      useCaseAgg.set(label, e);
    }
  }

  const paidDates = leads.filter((r) => r.campaignId).map((r) => r.dateAdded).sort();

  return {
    totals: lineFinance(leads, totalSpend),
    byLine,
    funnel: [
      { key: "leads", count: leads.length, value: 0 },
      { key: "answered", count: answered.length, value: 0 },
      { key: "quoted", count: quoted.length, value: sum(quoted) },
      { key: "won", count: won.length, value: sum(won) },
    ],
    byBucket,
    atRisk: { thresholdDays: atRiskDays, count: stale.length, value: sum(stale) },
    valueByStage: [...stageValue.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => a.position - b.position),
    byAd,
    byUseCase: [...useCaseAgg.values()].sort((a, b) => b.quotedValue - a.quotedValue || b.leads - a.leads),
    batteriesRequested: leads.reduce((s, r) => s + (r.batteryQty ?? 0), 0),
    batteriesQuoted: quoted.reduce((s, r) => s + (r.batteryQty ?? 0), 0),
    firstCampaignDate: paidDates[0] ?? null,
  };
}
