import { cookies } from "next/headers";
import { after } from "next/server";
import { getAllContacts, getAllMessages, getAllOpportunities, getPipelines } from "@/lib/ghl";
import {
  contactsBetween,
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
import { DEFAULT_PERIOD, SUMMARY_PERIODS, periodDates, periodFromParams, periodInfo } from "@/lib/periods";
import { pipelineHistoryFor, recordPipelineSnapshot } from "@/lib/snapshots";
import { getOpportunityEvents } from "@/lib/opportunity-history";
import { opportunityTiming } from "@/lib/opportunity-state";
import { isLang, DEFAULT_LANG, type Lang } from "@/lib/i18n";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tag?: string; periodo?: string; mes?: string }>;
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

  const params = await searchParams;
  const rawTag = params.tag;
  const range = periodFromParams(params, SUMMARY_PERIODS, DEFAULT_PERIOD);

  const [ghlContacts, allOpportunities, pipelines, allMessages, meta, history, eventLog] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllMessages(locationId),
    getMetaInsights(periodDates(range)),
    pipelineHistoryFor(range),
    getOpportunityEvents(),
  ]);
  const timing = eventLog ? opportunityTiming(eventLog) : undefined;

  const allContacts = excludeBulkImports(ghlContacts);
  const availableTags = distinctTags(allContacts);
  const selectedTag = rawTag && availableTags.includes(rawTag) ? rawTag : null;

  const contacts = selectedTag ? filterContactsByTag(allContacts, selectedTag) : allContacts;
  const contactIds = new Set(contacts.map((c) => c.id));
  const opportunities = selectedTag ? allOpportunities.filter((o) => contactIds.has(o.contactId)) : allOpportunities;
  const messages = selectedTag ? allMessages.filter((m) => contactIds.has(m.contactId)) : allMessages;
  const periodContacts = contactsBetween(contacts, range.start, range.end);

  const bySource = leadsBySource(periodContacts);
  const byCity = leadsByCity(periodContacts);
  const overTime = leadsOverTime(contacts, range.prevStart, range.end);
  const byStage = pipelineByStage(opportunities, pipelines);
  const byPipeline = opportunitiesByPipeline(opportunities, pipelines);
  const conversion = conversionSummary(opportunities, pipelines);
  const periodConversion = conversionBetween(opportunities, pipelines, range.start, range.end, timing);
  const prevPeriodConversion = conversionBetween(opportunities, pipelines, range.prevStart, range.prevSamePoint, timing);
  const responseTime = firstTouchResponseTime(contacts, messages, range.start, range.end);
  const newLeads = leadsInPeriod(contacts, range);
  const livePipeline = pipelineSnapshot(opportunities, pipelines);
  // History covers the whole pipeline, so it's only recorded and compared on the unfiltered view.
  if (!selectedTag) after(() => recordPipelineSnapshot(livePipeline));
  const pipelineHistory = selectedTag ? null : history;
  // A finished month shows the pipeline as it stood when that month closed.
  const closedPipeline = range.isPast && pipelineHistory?.configured ? pipelineHistory.atEnd : null;
  const stalled = stalledOpenOpportunities(opportunities, pipelines, 14, timing);

  const companyName = process.env.REPORT_COMPANY_NAME || "Nombre de empresa pendiente";

  return (
    <Dashboard
      companyName={companyName}
      contactsCount={contacts.length}
      opportunitiesCount={opportunities.length}
      generatedAtIso={new Date().toISOString()}
      period={range.key}
      periodInfo={periodInfo(range)}
      newLeads={newLeads}
      pipeline={closedPipeline ?? livePipeline}
      pipelineIsLive={closedPipeline === null}
      pipelineHistory={pipelineHistory}
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
