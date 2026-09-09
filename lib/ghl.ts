import "server-only";

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
};

type ContactsResponse = {
  contacts: GhlContact[];
  meta: { nextPage?: number; startAfter?: number; startAfterId?: string; total: number };
};

export async function getAllContacts(locationId: string): Promise<GhlContact[]> {
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
};

type OpportunitiesResponse = {
  opportunities: GhlOpportunity[];
  meta: { nextPage?: number; startAfter?: number; startAfterId?: string; total: number };
};

export async function getAllOpportunities(locationId: string): Promise<GhlOpportunity[]> {
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

export async function getPipelines(locationId: string): Promise<GhlPipeline[]> {
  const data = await ghlGet<{ pipelines: GhlPipeline[] }>("/opportunities/pipelines", { locationId });
  return data.pipelines;
}

export type GhlConversation = {
  id: string;
  contactId: string;
  dateAdded: number;
  lastMessageDate: number;
};

type ConversationsResponse = {
  conversations: GhlConversation[];
  total: number;
};

export async function getAllConversations(locationId: string): Promise<GhlConversation[]> {
  const all: GhlConversation[] = [];
  let startAfterId: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string | number> = { locationId, limit: 100 };
    if (startAfterId) params.startAfterId = startAfterId;
    const data = await ghlGet<ConversationsResponse>("/conversations/search", params);
    all.push(...data.conversations);
    if (data.conversations.length < 100) break;
    startAfterId = data.conversations[data.conversations.length - 1]?.id;
  }
  return all;
}
