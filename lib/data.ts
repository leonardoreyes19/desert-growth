import "server-only";
import { cookies } from "next/headers";
import { getAllContacts, getAllMessages, getAllOpportunities, getCustomFieldDefs, getPipelines } from "./ghl";
import { excludeBulkImports } from "./metrics";
import { getMetaAdSpend, type MetaAdSpend } from "./meta";
import { cohortBetween } from "./finance";
import { getOpportunityEvents } from "./opportunity-history";
import { periodDates, type PeriodRange } from "./periods";
import { attributedCampaignIds, buildLeadRows, fieldLabelsFrom, type FieldLabels, type LeadRow } from "./leads";
import { isLang, DEFAULT_LANG, type Lang } from "./i18n";

export type Prefs = { lang: Lang; theme: "light" | "dark" };

export async function readPrefs(): Promise<Prefs> {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("lang")?.value;
  return {
    lang: isLang(cookieLang) ? cookieLang : DEFAULT_LANG,
    theme: cookieStore.get("theme")?.value === "dark" ? "dark" : "light",
  };
}

export function requireLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error("Missing GHL_LOCATION_ID env var");
  return locationId;
}

export function companyName(): string {
  return process.env.REPORT_COMPANY_NAME || "Nombre de empresa pendiente";
}

export type LeadData = {
  /**
   * Leads with something happening in the period: they arrived, or moved stage
   * (quoted, won, lost…). All of them for Todo.
   */
  rows: LeadRow[];
  /** Leads that arrived in the period, costed with the period's spend. */
  arrivals: LeadRow[];
  /** Every lead, regardless of period, costed with lifetime spend. */
  allRows: LeadRow[];
  adSpend: MetaAdSpend[];
  currency: string;
  metaError: string | null;
  metaConfigured: boolean;
  fieldLabels: FieldLabels;
};

/**
 * CRM leads joined with the Meta spend of the campaigns they came from and
 * their stage history. For Semana / Mes, spend is what those campaigns spent
 * in the period; for Todo, lifetime.
 */
export async function loadLeadData(range: PeriodRange): Promise<LeadData> {
  const locationId = requireLocationId();
  const [contacts, opportunities, pipelines, messages, fieldDefs, history] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllMessages(locationId),
    getCustomFieldDefs(locationId),
    getOpportunityEvents(),
  ]);
  const campaignIds = attributedCampaignIds(opportunities);
  const dates = periodDates(range);
  const [lifetime, windowed] = await Promise.all([
    getMetaAdSpend(campaignIds),
    range.key === "todo" ? null : getMetaAdSpend(campaignIds, { since: dates.since, until: dates.until }),
  ]);
  const meta = windowed ?? lifetime;
  const ok = (m: typeof meta): m is Extract<typeof meta, { byAd: MetaAdSpend[] }> => m.configured && m.error === undefined;

  const allRows = buildLeadRows({
    locationId,
    contacts: excludeBulkImports(contacts),
    opportunities,
    pipelines,
    messages,
    adSpend: ok(lifetime) ? lifetime.byAd : [],
    history,
  });
  const adSpend = ok(meta) ? meta.byAd : [];

  let rows = allRows;
  let arrivals = allRows;
  if (range.key !== "todo") {
    arrivals = cohortBetween(allRows, range.start, range.end, adSpend);
    const arrivedIds = new Set(arrivals.map((r) => r.id));
    const movedInPeriod = allRows.filter(
      (r) => !arrivedIds.has(r.id) && r.events.some((e) => e.t >= range.start && e.t < range.end)
    );
    rows = [...arrivals, ...movedInPeriod];
  }

  return {
    rows,
    arrivals,
    allRows,
    adSpend,
    currency: ok(meta) ? meta.currency : "MXN",
    metaError: meta.configured && meta.error !== undefined ? meta.error : null,
    metaConfigured: meta.configured,
    fieldLabels: fieldLabelsFrom(fieldDefs),
  };
}
