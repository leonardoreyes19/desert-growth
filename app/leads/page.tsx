import type { Metadata } from "next";
import { companyName, loadLeadData, readPrefs } from "@/lib/data";
import { DEFAULT_TAB_PERIOD, isPeriodKey, periodRange } from "@/lib/periods";
import { LeadsView, type LeadFilters } from "@/components/LeadsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Leads · Desert Growth" };

type PageProps = {
  searchParams: Promise<{ stage?: string; line?: string; tag?: string; useCase?: string; stalled?: string; periodo?: string }>;
};

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = isPeriodKey(params.periodo) ? params.periodo : DEFAULT_TAB_PERIOD;
  const range = periodRange(period);
  const [prefs, data] = await Promise.all([readPrefs(), loadLeadData(range)]);

  const initialFilters: LeadFilters = {
    stage: params.stage || null,
    line: params.line || null,
    tag: params.tag || null,
    useCase: params.useCase || null,
    stalled: params.stalled === "1" ? "1" : null,
  };

  return (
    <LeadsView
      companyName={companyName()}
      generatedAtIso={new Date().toISOString()}
      currency={data.currency}
      rows={data.rows}
      period={period}
      periodStartIso={range.key === "todo" ? null : new Date(range.start).toISOString()}
      fieldLabels={data.fieldLabels}
      initialFilters={initialFilters}
      initialLang={prefs.lang}
      initialTheme={prefs.theme}
    />
  );
}
