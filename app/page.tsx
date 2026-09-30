import { cookies } from "next/headers";
import { after } from "next/server";
import { getAllContacts, getAllMessages, getAllOpportunities, getPipelines } from "@/lib/ghl";
import {
  contactsSince,
  conversionBetween,
  conversionSummary,
  distinctTags,
  excludeBulkImports,
  filterContactsByTag,
  firstTouchResponseTime,
  leadsByCity,
  leadsBySource,
  leadsInPeriod,
  leadsOverTime,
  opportunitiesByPipeline,
  pipelineByStage,
  pipelineSnapshot,
  stalledOpenOpportunities,
} from "@/lib/metrics";
import { getMetaInsights } from "@/lib/meta";
import { DEFAULT_PERIOD, isPeriodKey, periodDates, periodRange } from "@/lib/periods";
import { pipelineAtPeriodStart, recordPipelineSnapshot } from "@/lib/snapshots";
import { isLang, DEFAULT_LANG, type Lang } from "@/lib/i18n";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tag?: string; periodo?: string }>;
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

  const { tag: rawTag, periodo: rawPeriod } = await searchParams;
  const period = isPeriodKey(rawPeriod) ? rawPeriod : DEFAULT_PERIOD;
  const range = periodRange(period);

  const [ghlContacts, allOpportunities, pipelines, allMessages, meta, periodStartHistory] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllMessages(locationId),
    getMetaInsights(periodDates(range)),
    pipelineAtPeriodStart(range),
  ]);

  const allContacts = excludeBulkImports(ghlContacts);
  const availableTags = distinctTags(allContacts);
  const selectedTag = rawTag && availableTags.includes(rawTag) ? rawTag : null;

  const contacts = selectedTag ? filterContactsByTag(allContacts, selectedTag) : allContacts;
  const contactIds = new Set(contacts.map((c) => c.id));
  const opportunities = selectedTag ? allOpportunities.filter((o) => contactIds.has(o.contactId)) : allOpportunities;
  const messages = selectedTag ? allMessages.filter((m) => contactIds.has(m.contactId)) : allMessages;
  const periodContacts = contactsSince(contacts, range.start);

  const bySource = leadsBySource(periodContacts);
  const byCity = leadsByCity(periodContacts);
  const overTime = leadsOverTime(contacts, range.prevStart);
  const byStage = pipelineByStage(opportunities, pipelines);
  const byPipeline = opportunitiesByPipeline(opportunities, pipelines);
  const conversion = conversionSummary(opportunities, pipelines);
  const periodConversion = conversionBetween(opportunities, pipelines, range.start, Infinity);
  const prevPeriodConversion = conversionBetween(opportunities, pipelines, range.prevStart, range.prevSamePoint);
  const responseTime = firstTouchResponseTime(contacts, messages, range.start);
  const newLeads = leadsInPeriod(contacts, range);
  const pipeline = pipelineSnapshot(opportunities, pipelines);
  // History covers the whole pipeline, so it's only recorded and compared on the unfiltered view.
  if (!selectedTag) after(() => recordPipelineSnapshot(pipeline));
  const stalled = stalledOpenOpportunities(opportunities, pipelines, 14);

  const companyName = process.env.REPORT_COMPANY_NAME || "Nombre de empresa pendiente";

  return (
    <Dashboard
      companyName={companyName}
      contactsCount={contacts.length}
      opportunitiesCount={opportunities.length}
      generatedAtIso={new Date().toISOString()}
      period={period}
      newLeads={newLeads}
      pipeline={pipeline}
      pipelineHistory={selectedTag ? null : periodStartHistory}
      conversion={conversion}
      periodConversion={periodConversion}
      prevPeriodConversion={prevPeriodConversion}
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
