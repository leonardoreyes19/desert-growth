import "server-only";
import { cached } from "./server-cache";

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function headers() {
  return {
    Authorization: `Bearer ${assertEnv("GHL_PRIVATE_INTEGRATION_TOKEN")}`,
    Version: API_VERSION,
    Accept: "application/json",
  };
}

async function ghlGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status} on ${path}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export type GhlContact = {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  dateAdded: string;
  city?: string;
  tags?: string[];
  customFields?: GhlCustomFieldValue[];
};

export type GhlCustomFieldValue = {
  id: string;
  value: string | number | string[];
};

export type GhlAttribution = {
  utmCampaignId?: string;
  utmAdId?: string;
  utmSessionSource?: string;
  url?: string;
  isFirst?: boolean;
};

type ContactsResponse = {
  contacts: GhlContact[];
  meta: { nextPage?: number; startAfter?: number; startAfterId?: string; total: number };
};

async function fetchAllContacts(locationId: string): Promise<GhlContact[]> {
  const all: GhlContact[] = [];
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string | number> = { locationId, limit: 100 };
    if (startAfter) params.startAfter = startAfter;
    if (startAfterId) params.startAfterId = startAfterId;
    const data = await ghlGet<ContactsResponse>("/contacts/", params);
    all.push(...data.contacts);
    if (!data.meta?.nextPage || data.contacts.length === 0) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return all;
}

export function getAllContacts(locationId: string): Promise<GhlContact[]> {
  return cached(`ghl:contacts:${locationId}`, () => fetchAllContacts(locationId));
}

export type GhlOpportunity = {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: "open" | "won" | "lost" | "abandoned" | string;
  source?: string;
  contactId: string;
  createdAt: string;
  updatedAt: string;
  lastStatusChangeAt: string;
  lastStageChangeAt: string;
  lostReasonId?: string | null;
  attributions?: GhlAttribution[];
};

type OpportunitiesResponse = {
  opportunities: GhlOpportunity[];
  meta: { nextPage?: number; startAfter?: number; startAfterId?: string; total: number };
};

async function fetchAllOpportunities(locationId: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string | number> = { location_id: locationId, limit: 100 };
    if (startAfter) params.startAfter = startAfter;
    if (startAfterId) params.startAfterId = startAfterId;
    const data = await ghlGet<OpportunitiesResponse>("/opportunities/search", params);
    all.push(...data.opportunities);
    if (!data.meta?.nextPage || data.opportunities.length === 0) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return all;
}

export function getAllOpportunities(locationId: string): Promise<GhlOpportunity[]> {
  return cached(`ghl:opportunities:${locationId}`, () => fetchAllOpportunities(locationId));
}

export type GhlPipelineStage = {
  id: string;
  name: string;
  position: number;
};

export type GhlPipeline = {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
};

async function fetchPipelines(locationId: string): Promise<GhlPipeline[]> {
  const data = await ghlGet<{ pipelines: GhlPipeline[] }>("/opportunities/pipelines", { locationId });
  return data.pipelines;
}

export function getPipelines(locationId: string): Promise<GhlPipeline[]> {
  return cached(`ghl:pipelines:${locationId}`, () => fetchPipelines(locationId));
}

export type GhlMessage = {
  id: string;
  contactId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  /** "workflow" for automations; "app" when a person sends it from GHL or the WhatsApp Business app. */
  source?: string;
  messageType: string;
  dateAdded: string;
};

type MessagesExportResponse = {
  messages: GhlMessage[];
  nextCursor: string | null;
};

const MESSAGE_CHANNELS = ["WhatsApp", "SMS", "Email", "Call", "Facebook", "Instagram"];

/** Every message in the location, across all channels the export endpoint supports. */
async function fetchAllMessages(locationId: string): Promise<GhlMessage[]> {
  const perChannel = await Promise.all(
    MESSAGE_CHANNELS.map(async (channel) => {
      const all: GhlMessage[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 50; page++) {
        const params: Record<string, string | number> = { locationId, channel, limit: 100 };
        if (cursor) params.cursor = cursor;
        const data = await ghlGet<MessagesExportResponse>("/conversations/messages/export", params);
        all.push(...data.messages);
        cursor = data.nextCursor;
        if (!cursor) break;
      }
      return all;
    })
  );
  return perChannel.flat();
}

export function getAllMessages(locationId: string): Promise<GhlMessage[]> {
  return cached(`ghl:messages:${locationId}`, () => fetchAllMessages(locationId));
}

export type GhlCustomFieldDef = {
  id: string;
  name: string;
};

/**
 * Requires the `locations/customFields.readonly` scope on the private
 * integration token. Returns null (instead of throwing) when the token lacks
 * it, so callers can fall back to known labels.
 */
async function fetchCustomFieldDefs(locationId: string): Promise<GhlCustomFieldDef[] | null> {
  try {
    const data = await ghlGet<{ customFields: GhlCustomFieldDef[] }>(`/locations/${locationId}/customFields`, {});
    return data.customFields;
  } catch {
    return null;
  }
}

export function getCustomFieldDefs(locationId: string): Promise<GhlCustomFieldDef[] | null> {
  return cached(`ghl:customFields:${locationId}`, () => fetchCustomFieldDefs(locationId));
}

export type GhlNote = {
  id: string;
  body?: string;
  bodyText?: string;
  userId?: string;
  dateAdded: string;
};

export async function getContactNotes(contactId: string): Promise<GhlNote[]> {
  const data = await ghlGet<{ notes: GhlNote[] }>(`/contacts/${contactId}/notes`, {});
  return data.notes ?? [];
}
