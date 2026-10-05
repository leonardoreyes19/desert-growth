import type { Metadata } from "next";
import { companyName, loadLeadData, readPrefs } from "@/lib/data";
import { financeSummary } from "@/lib/finance";
import { DEFAULT_TAB_PERIOD, TAB_PERIODS, periodFromParams, periodInfo } from "@/lib/periods";
import { MoneyView } from "@/components/MoneyView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dinero · Desert Growth" };

type PageProps = {
  searchParams: Promise<{ periodo?: string; mes?: string }>;
};

export default async function MoneyPage({ searchParams }: PageProps) {
  const range = periodFromParams(await searchParams, TAB_PERIODS, DEFAULT_TAB_PERIOD);
  const [prefs, data] = await Promise.all([readPrefs(), loadLeadData(range)]);

  return (
    <MoneyView
      companyName={companyName()}
      generatedAtIso={new Date().toISOString()}
      currency={data.currency}
      periodInfo={periodInfo(range)}
      finance={financeSummary(data.rows, data.adSpend, data.allRows)}
      metaConfigured={data.metaConfigured}
      metaError={data.metaError}
      initialLang={prefs.lang}
      initialTheme={prefs.theme}
    />
  );
}
