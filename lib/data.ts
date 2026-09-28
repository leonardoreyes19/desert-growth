import "server-only";
import { cookies } from "next/headers";
import { getAllContacts, getAllConversations, getAllOpportunities, getCustomFieldDefs, getPipelines } from "./ghl";
import { getMetaLifetimeSpend, type MetaAdSpend } from "./meta";
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
  rows: LeadRow[];
  adSpend: MetaAdSpend[];
  currency: string;
  metaError: string | null;
  metaConfigured: boolean;
  fieldLabels: FieldLabels;
};

/** CRM leads joined with lifetime Meta spend of the campaigns they came from. */
export async function loadLeadData(): Promise<LeadData> {
  const locationId = requireLocationId();
  const [contacts, opportunities, pipelines, conversations, fieldDefs] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllConversations(locationId),
    getCustomFieldDefs(locationId),
  ]);
  const meta = await getMetaLifetimeSpend(attributedCampaignIds(opportunities));
  const adSpend = meta.configured && meta.error === undefined ? meta.byAd : [];

  return {
    rows: buildLeadRows({ locationId, contacts, opportunities, pipelines, conversations, adSpend }),
    adSpend,
    currency: meta.configured && meta.error === undefined ? meta.currency : "MXN",
    metaError: meta.configured && meta.error !== undefined ? meta.error : null,
    metaConfigured: meta.configured,
    fieldLabels: fieldLabelsFrom(fieldDefs),
  };
}
