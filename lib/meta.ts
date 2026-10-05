import "server-only";
import { cached } from "./server-cache";

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
 *   META_LEAD_ACTION_TYPE  Optional exact action_type to count as "lead"
 *                          (e.g. offsite_conversion.custom.<id> for the
 *                          "Marina – Lead" custom conversion). If unset, any
 *                          action_type containing "lead" is summed.
 */

const DEFAULT_VERSION = "v21.0";

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

/** Reporting window as Hermosillo dates: the current period and the previous one up to the same point. */
export type MetaDates = { since: string; until: string; prevSince: string; prevUntil: string };

export type MetaPrevious = { spend: number; leads: number; cpl: number | null; ctr: number | null };

export type MetaInsights =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      error?: undefined;
      currency: string;
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
      /** Both periods, prevSince through until, for the daily trend. */
      byDay: MetaDayKpi[];
      byDemographic: MetaSegmentKpi[];
      byPlacement: MetaSegmentKpi[];
      previous: MetaPrevious;
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

async function fetchMetaInsights(dates: MetaDates): Promise<MetaInsights> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token || !rawAccount) return { configured: false };

  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  const period = { time_range: JSON.stringify({ since: dates.since, until: dates.until }) };
  const bothPeriods = { time_range: JSON.stringify({ since: dates.prevSince, until: dates.until }) };
  const baseFields = "campaign_name,account_currency,spend,impressions,reach,clicks,ctr,cpc,cpm,actions";
  const dayFields = "spend,impressions,clicks,actions";
  const segmentFields = "spend,actions";

  try {
    const [summaryRows, campaignRows, dayRows, demographicRows, placementRows] = await Promise.all([
      graphGet(`${account}/insights`, { ...period, fields: baseFields, level: "account" }),
      graphGet(`${account}/insights`, { ...period, fields: baseFields, level: "campaign", limit: "200" }),
      graphGet(`${account}/insights`, { ...bothPeriods, fields: dayFields, level: "account", time_increment: "1" }),
      graphGet(`${account}/insights`, { ...period, fields: segmentFields, level: "account", breakdowns: "age,gender" }),
      graphGet(`${account}/insights`, {
        ...period,
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

    const prevRows = dayRows.filter((r) => r.date_start && r.date_start >= dates.prevSince && r.date_start <= dates.prevUntil);
    const prevSpend = prevRows.reduce((sum, r) => sum + num(r.spend), 0);
    const prevLeads = prevRows.reduce((sum, r) => sum + countLeads(r.actions), 0);
    const prevImpressions = prevRows.reduce((sum, r) => sum + num(r.impressions), 0);
    const prevClicks = prevRows.reduce((sum, r) => sum + num(r.clicks), 0);

    const byDemographic = aggregateBySegment(demographicRows, (r) => `${r.age || "unknown"}|${r.gender || "unknown"}`);

    const byPlacement = aggregateBySegment(
      placementRows,
      (r) => `${r.publisher_platform || "unknown"}|${(r.platform_position || "").replace(/_/g, " ")}`
    );

    return {
      configured: true,
      currency: s.account_currency || "MXN",
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
      previous: {
        spend: prevSpend,
        leads: prevLeads,
        cpl: prevLeads > 0 ? prevSpend / prevLeads : null,
        ctr: prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : null,
      },
    };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export type MetaAdSpend = {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
};

export type MetaLifetimeSpend =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; error?: undefined; currency: string; byAd: MetaAdSpend[] };

/**
 * Spend per ad (lifetime, or for a date range) for the given campaigns — the
 * ones CRM leads are attributed to via their utm campaign id. Used to compute
 * real cost per lead / quote / sale against CRM outcomes. Same fail-safe
 * contract as getMetaInsights().
 */
async function fetchMetaAdSpend(campaignIds: string[], dates: { since: string; until: string } | null): Promise<MetaLifetimeSpend> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token || !rawAccount) return { configured: false };
  if (campaignIds.length === 0) return { configured: true, currency: "MXN", byAd: [] };

  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  try {
    const rows = (await graphGet(`${account}/insights`, {
      ...(dates ? { time_range: JSON.stringify(dates) } : { date_preset: "maximum" }),
      level: "ad",
      fields: "ad_id,ad_name,campaign_id,campaign_name,spend,account_currency",
      filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]),
      limit: "500",
    })) as (InsightRow & { ad_id?: string; ad_name?: string; campaign_id?: string })[];

    return {
      configured: true,
      currency: rows[0]?.account_currency || "MXN",
      byAd: rows.map((r) => ({
        adId: r.ad_id || "",
        adName: r.ad_name || "(sin nombre)",
        campaignId: r.campaign_id || "",
        campaignName: r.campaign_name || "(sin nombre)",
        spend: num(r.spend),
      })),
    };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? err.message : String(err) };
  }
}

// Meta errors come back as values, not exceptions — don't hold on to them.
const keepUnlessError = (r: { configured: boolean; error?: string }) => !(r.configured && r.error !== undefined);

export function getMetaInsights(dates: MetaDates): Promise<MetaInsights> {
  const key = `meta:insights:${dates.prevSince}:${dates.prevUntil}:${dates.since}:${dates.until}`;
  return cached(key, () => fetchMetaInsights(dates), { keep: keepUnlessError });
}

/** Spend per ad for the given campaigns: lifetime, or between two Hermosillo dates. */
export function getMetaAdSpend(campaignIds: string[], dates: { since: string; until: string } | null = null): Promise<MetaLifetimeSpend> {
  const range = dates ? `${dates.since}:${dates.until}` : "lifetime";
  const key = `meta:adspend:${range}:${[...campaignIds].sort().join(",")}`;
  return cached(key, () => fetchMetaAdSpend(campaignIds, dates), { keep: keepUnlessError });
}
