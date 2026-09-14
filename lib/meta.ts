import "server-only";

/**
 * Meta (Facebook/Instagram) Ads Insights — spend & performance KPIs.
 *
 * Additive and fail-safe: if META_ACCESS_TOKEN / META_AD_ACCOUNT_ID are not set,
 * getMetaInsights() returns { configured: false } and the dashboard renders as
 * before. Any API error is caught and surfaced as { configured: true, error },
 * never thrown, so a bad token can't take down the whole page.
 *
 * Env vars:
 *   META_ACCESS_TOKEN      System User / long-lived token with `ads_read`.
 *   META_AD_ACCOUNT_ID     Ad account id, with or without the `act_` prefix.
 *   META_API_VERSION       Graph API version (default v21.0).
 *   META_DATE_PRESET       Reporting window (default last_30d).
 *   META_LEAD_ACTION_TYPE  Optional exact action_type to count as "lead"
 *                          (e.g. offsite_conversion.custom.<id> for the
 *                          "Marina – Lead" custom conversion). If unset, any
 *                          action_type containing "lead" is summed.
 */

const DEFAULT_VERSION = "v21.0";
const DEFAULT_PRESET = "last_30d";

type MetaAction = { action_type: string; value: string };

type InsightRow = {
  campaign_name?: string;
  account_currency?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  date_start?: string;
  age?: string;
  gender?: string;
  publisher_platform?: string;
  platform_position?: string;
};

export type MetaCampaignKpi = {
  name: string;
  spend: number;
  clicks: number;
  ctr: number;
  leads: number;
  cpl: number | null;
};

export type MetaDayKpi = {
  date: string;
  spend: number;
  leads: number;
};

export type MetaSegmentKpi = {
  segment: string;
  spend: number;
  leads: number;
  cpl: number | null;
};

export type MetaWeekOverWeek = {
  thisWeekSpend: number;
  lastWeekSpend: number;
  spendDeltaPct: number | null;
  thisWeekLeads: number;
  lastWeekLeads: number;
  leadsDeltaPct: number | null;
  cplThisWeek: number | null;
  cplLastWeek: number | null;
};

export type MetaInsights =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      error?: undefined;
      currency: string;
      datePreset: string;
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      ctr: number;
      cpc: number;
      cpm: number;
      leads: number;
      cpl: number | null;
      byCampaign: MetaCampaignKpi[];
      byDay: MetaDayKpi[];
      byDemographic: MetaSegmentKpi[];
      byPlacement: MetaSegmentKpi[];
      weekOverWeek: MetaWeekOverWeek;
    };

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function countLeads(actions: MetaAction[] | undefined): number {
  if (!actions) return 0;
  const exact = process.env.META_LEAD_ACTION_TYPE?.trim();
  return actions.reduce((sum, a) => {
    const match = exact ? a.action_type === exact : a.action_type.includes("lead");
    return match ? sum + num(a.value) : sum;
  }, 0);
}

async function graphGet(path: string, params: Record<string, string>): Promise<InsightRow[]> {
  const version = process.env.META_API_VERSION?.trim() || DEFAULT_VERSION;
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN as string);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (body?.data ?? []) as InsightRow[];
}

function aggregateBySegment(rows: InsightRow[], segmentOf: (r: InsightRow) => string): MetaSegmentKpi[] {
  const byKey = new Map<string, { spend: number; leads: number }>();
  for (const r of rows) {
    const key = segmentOf(r);
    const spend = num(r.spend);
    const leads = countLeads(r.actions);
    const existing = byKey.get(key) ?? { spend: 0, leads: 0 };
    byKey.set(key, { spend: existing.spend + spend, leads: existing.leads + leads });
  }
  return [...byKey.entries()]
    .map(([segment, { spend, leads }]) => ({ segment, spend, leads, cpl: leads > 0 ? spend / leads : null }))
    .sort((a, b) => b.spend - a.spend);
}

function computeWeekOverWeek(byDay: MetaDayKpi[]): MetaWeekOverWeek {
  const sorted = [...byDay].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);

  const sum = (days: MetaDayKpi[], key: "spend" | "leads") => days.reduce((s, d) => s + d[key], 0);

  const thisWeekSpend = sum(last7, "spend");
  const lastWeekSpend = sum(prev7, "spend");
  const thisWeekLeads = sum(last7, "leads");
  const lastWeekLeads = sum(prev7, "leads");

  return {
    thisWeekSpend,
    lastWeekSpend,
    spendDeltaPct: lastWeekSpend > 0 ? (thisWeekSpend - lastWeekSpend) / lastWeekSpend : null,
    thisWeekLeads,
    lastWeekLeads,
    leadsDeltaPct: lastWeekLeads > 0 ? (thisWeekLeads - lastWeekLeads) / lastWeekLeads : null,
    cplThisWeek: thisWeekLeads > 0 ? thisWeekSpend / thisWeekLeads : null,
    cplLastWeek: lastWeekLeads > 0 ? lastWeekSpend / lastWeekLeads : null,
  };
}

export async function getMetaInsights(): Promise<MetaInsights> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token || !rawAccount) return { configured: false };

  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  const datePreset = process.env.META_DATE_PRESET?.trim() || DEFAULT_PRESET;
  const baseFields = "campaign_name,account_currency,spend,impressions,reach,clicks,ctr,cpc,cpm,actions";
  const dayFields = "spend,actions";
  const segmentFields = "spend,actions";

  try {
    const [summaryRows, campaignRows, dayRows, demographicRows, placementRows] = await Promise.all([
      graphGet(`${account}/insights`, { date_preset: datePreset, fields: baseFields, level: "account" }),
      graphGet(`${account}/insights`, { date_preset: datePreset, fields: baseFields, level: "campaign", limit: "200" }),
      graphGet(`${account}/insights`, { date_preset: datePreset, fields: dayFields, level: "account", time_increment: "1" }),
      graphGet(`${account}/insights`, { date_preset: datePreset, fields: segmentFields, level: "account", breakdowns: "age,gender" }),
      graphGet(`${account}/insights`, {
        date_preset: datePreset,
        fields: segmentFields,
        level: "account",
        breakdowns: "publisher_platform,platform_position",
      }),
    ]);

    const s = summaryRows[0] ?? {};
    const spend = num(s.spend);
    const leads = countLeads(s.actions);

    const byCampaign: MetaCampaignKpi[] = campaignRows
      .map((r) => {
        const cSpend = num(r.spend);
        const cLeads = countLeads(r.actions);
        return {
          name: r.campaign_name || "(sin nombre)",
          spend: cSpend,
          clicks: num(r.clicks),
          ctr: num(r.ctr),
          leads: cLeads,
          cpl: cLeads > 0 ? cSpend / cLeads : null,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const byDay: MetaDayKpi[] = dayRows
      .map((r) => ({ date: r.date_start || "", spend: num(r.spend), leads: countLeads(r.actions) }))
      .filter((d) => d.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const byDemographic = aggregateBySegment(demographicRows, (r) => `${r.age || "unknown"}|${r.gender || "unknown"}`);

    const byPlacement = aggregateBySegment(
      placementRows,
      (r) => `${r.publisher_platform || "unknown"}|${(r.platform_position || "").replace(/_/g, " ")}`
    );

    return {
      configured: true,
      currency: s.account_currency || "MXN",
      datePreset,
      spend,
      impressions: num(s.impressions),
      reach: num(s.reach),
      clicks: num(s.clicks),
      ctr: num(s.ctr),
      cpc: num(s.cpc),
      cpm: num(s.cpm),
      leads,
      cpl: leads > 0 ? spend / leads : null,
      byCampaign,
      byDay,
      byDemographic,
      byPlacement,
      weekOverWeek: computeWeekOverWeek(byDay),
    };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? err.message : String(err) };
  }
}
