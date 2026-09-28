import type { Metadata } from "next";
import { companyName, loadLeadData, readPrefs } from "@/lib/data";
import { LeadsView, type LeadFilters } from "@/components/LeadsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Leads · Desert Growth" };

type PageProps = {
  searchParams: Promise<{ stage?: string; line?: string; tag?: string; useCase?: string }>;
};

export default async function LeadsPage({ searchParams }: PageProps) {
  const [prefs, data, params] = await Promise.all([readPrefs(), loadLeadData(), searchParams]);

  const initialFilters: LeadFilters = {
    stage: params.stage || null,
    line: params.line || null,
    tag: params.tag || null,
    useCase: params.useCase || null,
  };

  return (
    <LeadsView
      companyName={companyName()}
      generatedAtIso={new Date().toISOString()}
      currency={data.currency}
      rows={data.rows}
      fieldLabels={data.fieldLabels}
      initialFilters={initialFilters}
      initialLang={prefs.lang}
      initialTheme={prefs.theme}
    />
  );
}
