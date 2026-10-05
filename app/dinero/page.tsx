import type { Metadata } from "next";
import { companyName, loadLeadData, readPrefs } from "@/lib/data";
import { financeSummary } from "@/lib/finance";
import { DEFAULT_TAB_PERIOD, isPeriodKey, periodRange } from "@/lib/periods";
import { MoneyView } from "@/components/MoneyView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dinero · Desert Growth" };

type PageProps = {
  searchParams: Promise<{ periodo?: string }>;
};

export default async function MoneyPage({ searchParams }: PageProps) {
  const { periodo } = await searchParams;
  const period = isPeriodKey(periodo) ? periodo : DEFAULT_TAB_PERIOD;
  const range = periodRange(period);
  const [prefs, data] = await Promise.all([readPrefs(), loadLeadData(range)]);

  return (
    <MoneyView
      companyName={companyName()}
      generatedAtIso={new Date().toISOString()}
      currency={data.currency}
      period={period}
      periodStartIso={range.key === "todo" ? null : new Date(range.start).toISOString()}
      finance={financeSummary(data.rows, data.adSpend, data.allRows)}
      metaConfigured={data.metaConfigured}
      metaError={data.metaError}
      initialLang={prefs.lang}
      initialTheme={prefs.theme}
    />
  );
}
