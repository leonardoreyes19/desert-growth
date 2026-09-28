import type { Metadata } from "next";
import { companyName, loadLeadData, readPrefs } from "@/lib/data";
import { financeSummary } from "@/lib/finance";
import { MoneyView } from "@/components/MoneyView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dinero · Desert Growth" };

export default async function MoneyPage() {
  const [prefs, data] = await Promise.all([readPrefs(), loadLeadData()]);

  return (
    <MoneyView
      companyName={companyName()}
      generatedAtIso={new Date().toISOString()}
      currency={data.currency}
      finance={financeSummary(data.rows, data.adSpend)}
      metaConfigured={data.metaConfigured}
      metaError={data.metaError}
      initialLang={prefs.lang}
      initialTheme={prefs.theme}
    />
  );
}
