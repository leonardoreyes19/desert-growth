import type { GhlContact, GhlCustomFieldDef, GhlMessage, GhlOpportunity, GhlPipeline } from "./ghl";
import type { MetaAdSpend } from "./meta";
import { firstHumanReplyByContact } from "./metrics";

export type ProductLine = "golf" | "marine" | "other";

export type StageBucket =
  | "new"
  | "contacted"
  | "noResponse"
  | "quoted"
  | "negotiation"
  | "won"
  | "lost"
  | "disqualified"
  | "lithium"
  | "other";

/** Buckets that count as "money spent with nothing to show for it". */
export const DEAD_BUCKETS: StageBucket[] = ["lost", "disqualified", "noResponse"];
/** Buckets where a quote has been sent (current stage at or past "Cotización enviada"). */
export const QUOTED_BUCKETS: StageBucket[] = ["quoted", "negotiation", "won"];

export type LeadNote = { id: string; text: string; dateAdded: string };

export type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  dateAdded: string;
  tags: string[];
  line: ProductLine;
  pipelineName: string | null;
  stage: string | null;
  stagePosition: number;
  bucket: StageBucket;
  value: number;
  daysInStage: number | null;
  daysSinceCreated: number;
  useCase: string[];
  batteryQty: number | null;
  batteryQtyRaw: string | null;
  problem: string | null;
  equipment: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adId: string | null;
  adName: string | null;
  channel: string;
  estCost: number;
  firstResponseMinutes: number | null;
  ghlUrl: string;
};

// Custom field ids in this GHL location. Names come from the API when the
// token has `locations/customFields.readonly`; otherwise these labels are used.
// They were inferred from the lead intake forms' answers.
const FIELD_USE_CASE = "LHd7jeNkhDthvqmJo8ZT";
const FIELD_BATTERY_QTY = "LSwJcKLCuHEpskcSx5sZ";
const FIELD_PROBLEM = "E3xr2evTsbRz43wiHmWJ";
const FIELD_EQUIPMENT = "s5jkINd6xHjYEPRbapPx";

export type FieldLabels = { useCase: string | null; batteryQty: string | null; problem: string | null; equipment: string | null };

export function fieldLabelsFrom(defs: GhlCustomFieldDef[] | null): FieldLabels {
  const byId = new Map((defs ?? []).map((d) => [d.id, d.name]));
  return {
    useCase: byId.get(FIELD_USE_CASE) ?? null,
    batteryQty: byId.get(FIELD_BATTERY_QTY) ?? null,
    problem: byId.get(FIELD_PROBLEM) ?? null,
    equipment: byId.get(FIELD_EQUIPMENT) ?? null,
  };
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12,
};

/**
 * The quantity question is free text. Only accept answers that are just a
 * count ("6", "6 baterías", "Una", "dos"); free-form answers like
 * "GEM 2002, 72 volt" would otherwise read a year or voltage as a quantity.
 */
export function parseBatteryQty(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,3}|[a-zá-ú]+)\s*(bater[ií]as?|pzas?\.?|piezas?|unidad(es)?)?\.?$/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
  return n && n > 0 ? n : null;
}

export function bucketForStage(stageName: string | null, status: string | undefined): StageBucket {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  const s = (stageName ?? "").toLowerCase();
  if (/ganad/.test(s)) return "won";
  if (/perdid/.test(s)) return "lost";
  if (/descalificad/.test(s)) return "disqualified";
  if (/sin respuesta/.test(s)) return "noResponse";
  if (/negociaci/.test(s)) return "negotiation";
  if (/cotizaci/.test(s)) return "quoted";
  if (/contactad/.test(s)) return "contacted";
  if (/nuevo/.test(s)) return "new";
  if (/litio/.test(s)) return "lithium";
  return "other";
}

function lineForPipeline(name: string | null): ProductLine {
  if (!name) return "other";
  if (/golf|carrit/i.test(name)) return "golf";
  if (/marin|náutic|nautic/i.test(name)) return "marine";
  return "other";
}

function fieldValue(contact: GhlContact, id: string): string | string[] | null {
  const f = contact.customFields?.find((cf) => cf.id === id);
  if (!f || f.value === "" || f.value == null) return null;
  return Array.isArray(f.value) ? f.value : String(f.value).trim() || null;
}

function asText(v: string | string[] | null): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v.join(", ") : v;
}

const DAY_MS = 86_400_000;

export function buildLeadRows(input: {
  locationId: string;
  contacts: GhlContact[];
  opportunities: GhlOpportunity[];
  pipelines: GhlPipeline[];
  messages: GhlMessage[];
  adSpend: MetaAdSpend[];
}): LeadRow[] {
  const { locationId, contacts, opportunities, pipelines, messages, adSpend } = input;
  const now = Date.now();

  const pipelineName = new Map(pipelines.map((p) => [p.id, p.name]));
  const stageInfo = new Map<string, { name: string; position: number }>();
  for (const p of pipelines) for (const s of p.stages) stageInfo.set(s.id, { name: s.name, position: s.position });

  // One opportunity per contact in this location; if a contact ever has more,
  // keep the most recently updated one.
  const oppByContact = new Map<string, GhlOpportunity>();
  for (const o of opportunities) {
    const existing = oppByContact.get(o.contactId);
    if (!existing || o.updatedAt > existing.updatedAt) oppByContact.set(o.contactId, o);
  }

  const firstReplyAt = firstHumanReplyByContact(contacts, messages);

  const adsById = new Map(adSpend.map((a) => [a.adId, a]));
  const campaignNames = new Map(adSpend.map((a) => [a.campaignId, a.campaignName]));

  // Cost per CRM lead, per campaign: campaign lifetime spend / CRM leads attributed to it.
  const campaignSpend = new Map<string, number>();
  for (const a of adSpend) campaignSpend.set(a.campaignId, (campaignSpend.get(a.campaignId) ?? 0) + a.spend);
  const leadsPerCampaign = new Map<string, number>();
  for (const o of oppByContact.values()) {
    const id = firstAttribution(o)?.utmCampaignId;
    if (id) leadsPerCampaign.set(id, (leadsPerCampaign.get(id) ?? 0) + 1);
  }

  return contacts.map((c) => {
    const o = oppByContact.get(c.id);
    const stage = o ? stageInfo.get(o.pipelineStageId) : undefined;
    const pName = o ? pipelineName.get(o.pipelineId) ?? null : null;
    const attr = o ? firstAttribution(o) : undefined;
    const campaignId = attr?.utmCampaignId ?? null;
    const adId = attr?.utmAdId ?? null;
    const spend = campaignId ? campaignSpend.get(campaignId) : undefined;
    const campaignLeads = campaignId ? leadsPerCampaign.get(campaignId) : undefined;

    const qtyRaw = asText(fieldValue(c, FIELD_BATTERY_QTY));
    const useCaseRaw = fieldValue(c, FIELD_USE_CASE);
    const reply = firstReplyAt.get(c.id);
    const created = new Date(c.dateAdded).getTime();
    const responseMinutes = reply !== undefined ? (reply - created) / 60000 : null;

    const name =
      c.contactName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || c.phone || "(sin nombre)";

    return {
      id: c.id,
      name: toTitle(name),
      phone: c.phone ?? null,
      email: c.email ?? null,
      city: c.city?.trim() ? toTitle(c.city.trim()) : null,
      dateAdded: c.dateAdded,
      tags: (c.tags ?? []).map((t) => t.trim()).filter(Boolean),
      line: lineForPipeline(pName),
      pipelineName: pName,
      stage: stage?.name ?? null,
      stagePosition: stage?.position ?? 999,
      bucket: o ? bucketForStage(stage?.name ?? null, o.status) : "other",
      value: o?.monetaryValue ?? 0,
      daysInStage: o?.lastStageChangeAt ? Math.max(0, (now - new Date(o.lastStageChangeAt).getTime()) / DAY_MS) : null,
      daysSinceCreated: Math.max(0, (now - created) / DAY_MS),
      useCase: useCaseRaw == null ? [] : Array.isArray(useCaseRaw) ? useCaseRaw : [useCaseRaw],
      batteryQty: parseBatteryQty(qtyRaw),
      batteryQtyRaw: qtyRaw,
      problem: asText(fieldValue(c, FIELD_PROBLEM)),
      equipment: asText(fieldValue(c, FIELD_EQUIPMENT)),
      campaignId,
      campaignName: campaignId ? campaignNames.get(campaignId) ?? null : null,
      adId,
      adName: adId ? adsById.get(adId)?.adName ?? null : null,
      channel: campaignId ? "Meta Ads" : attr?.utmSessionSource || c.source || "Desconocido",
      estCost: spend !== undefined && campaignLeads ? spend / campaignLeads : 0,
      firstResponseMinutes: responseMinutes,
      ghlUrl: `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${c.id}`,
    };
  });
}

function firstAttribution(o: GhlOpportunity) {
  return o.attributions?.find((a) => a.isFirst) ?? o.attributions?.[0];
}

/** Campaign ids CRM leads are attributed to, for the Meta spend lookup. */
export function attributedCampaignIds(opportunities: GhlOpportunity[]): string[] {
  const ids = new Set<string>();
  for (const o of opportunities) {
    const id = firstAttribution(o)?.utmCampaignId;
    if (id && /^\d+$/.test(id)) ids.add(id);
  }
  return [...ids];
}

function toTitle(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
