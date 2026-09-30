import { cookies } from "next/headers";
import { getAllContacts, getAllMessages, getAllOpportunities, getPipelines } from "@/lib/ghl";
import {
  conversionSummary,
  distinctTags,
  excludeBulkImports,
  filterContactsByTag,
  firstTouchResponseTime,
  leadsByCity,
  leadsBySource,
  leadsOverTime,
  leadsMonthToDate,
  leadsWeekToDate,
  opportunitiesByPipeline,
  pipelineByStage,
  pipelineSnapshot,
  stalledOpenOpportunities,
} from "@/lib/metrics";
import { getMetaInsights } from "@/lib/meta";
import { recordPipelineSnapshot } from "@/lib/snapshots";
import { isLang, DEFAULT_LANG, type Lang } from "@/lib/i18n";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tag?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error("Missing GHL_LOCATION_ID env var");
  }

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("lang")?.value;
  const lang: Lang = isLang(cookieLang) ? cookieLang : DEFAULT_LANG;
  const cookieTheme = cookieStore.get("theme")?.value;
  const initialTheme = cookieTheme === "dark" ? "dark" : "light";

  const [ghlContacts, allOpportunities, pipelines, allMessages, meta] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllMessages(locationId),
    getMetaInsights(),
  ]);

  const allContacts = excludeBulkImports(ghlContacts);
  const availableTags = distinctTags(allContacts);
  const { tag: rawTag } = await searchParams;
  const selectedTag = rawTag && availableTags.includes(rawTag) ? rawTag : null;

  const contacts = selectedTag ? filterContactsByTag(allContacts, selectedTag) : allContacts;
  const contactIds = new Set(contacts.map((c) => c.id));
  const opportunities = selectedTag ? allOpportunities.filter((o) => contactIds.has(o.contactId)) : allOpportunities;
  const messages = selectedTag ? allMessages.filter((m) => contactIds.has(m.contactId)) : allMessages;

  const bySource = leadsBySource(contacts);
  const byCity = leadsByCity(contacts);
  const overTime = leadsOverTime(contacts, 30);
  const byStage = pipelineByStage(opportunities, pipelines);
  const byPipeline = opportunitiesByPipeline(opportunities, pipelines);
  const conversion = conversionSummary(opportunities, pipelines);
  const responseTime = firstTouchResponseTime(contacts, messages);
  const wow = leadsWeekToDate(contacts);
  const newLeadsMonth = leadsMonthToDate(contacts);
  const pipeline = pipelineSnapshot(opportunities, pipelines);
  // History is for the whole pipeline, so only record/compare it on the unfiltered view.
  const pipelineHistory = selectedTag ? null : await recordPipelineSnapshot(pipeline);
  const stalled = stalledOpenOpportunities(opportunities, pipelines, 14);

  const companyName = process.env.REPORT_COMPANY_NAME || "Nombre de empresa pendiente";

  return (
    <Dashboard
      companyName={companyName}
      contactsCount={contacts.length}
      opportunitiesCount={opportunities.length}
      generatedAtIso={new Date().toISOString()}
      wow={wow}
      newLeadsMonth={newLeadsMonth}
      pipeline={pipeline}
      pipelineHistory={pipelineHistory}
      conversion={conversion}
      responseTime={responseTime}
      bySource={bySource}
      overTime={overTime}
      byCity={byCity}
      byStage={byStage}
      byPipeline={byPipeline}
      stalled={stalled}
      meta={meta}
      availableTags={availableTags}
      selectedTag={selectedTag}
      initialLang={lang}
      initialTheme={initialTheme}
    />
  );
}
