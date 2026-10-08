"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import type { PeriodInfo, PeriodKey } from "@/lib/periods";
import type { Dict } from "@/components/AppHeader";
import { InfoNote } from "@/components/InfoNote";

/** Semana / Mes (/ Todo) segmented control shared by Resumen, Dinero and Leads. */
export function PeriodFilter<P extends PeriodKey>({
  periods,
  selected,
  onChange,
  label,
  options,
}: {
  periods: P[];
  selected: P;
  onChange: (period: P) => void;
  label: string;
  options: Record<PeriodKey, string>;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={selected}
      onValueChange={(next) => next && onChange(next as P)}
      aria-label={label}
      className="inline-flex p-1 rounded-full"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
    >
      {periods.map((key) => (
        <ToggleGroup.Item
          key={key}
          value={key}
          className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--series-1)]"
          style={{
            color: selected === key ? "#ffffff" : "var(--text-secondary)",
            background: selected === key ? "var(--series-1)" : "transparent",
          }}
        >
          {options[key]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export type PeriodChoice<P extends PeriodKey> = { period: P; month: string | null };

/** Sets ?periodo= and ?mes= on a URL query, leaving them out when they're the defaults. */
export function applyPeriodParams<P extends PeriodKey>(params: URLSearchParams, choice: PeriodChoice<P>, defaultPeriod: P, currentMonth: string | null) {
  params.delete("periodo");
  params.delete("mes");
  if (choice.period !== defaultPeriod) params.set("periodo", choice.period);
  if (choice.period === "mes" && choice.month && choice.month !== currentMonth) params.set("mes", choice.month);
}

/**
 * Switches the page's period (keeping every other URL param) with a server
 * navigation, and reports the requested choice while it loads.
 */
export function usePeriodSwitch<P extends PeriodKey>(current: PeriodChoice<P>, defaultPeriod: P, currentMonth: string | null) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(current);

  function change(next: PeriodChoice<P>) {
    const params = new URLSearchParams(window.location.search);
    applyPeriodParams(params, next, defaultPeriod, currentMonth);
    const query = params.toString();
    setRequested(next);
    startTransition(() => router.push(query ? `${window.location.pathname}?${query}` : window.location.pathname));
  }

  return { pending, shown: pending ? requested : current, change };
}

const monthName = (ym: string, locale: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
};

/** Period control, month picker (for Mes) and a caption saying which dates are on screen. */
export function PeriodBar<P extends PeriodKey>({
  periods,
  selected,
  onChange,
  info,
  t,
  locale,
  note,
}: {
  periods: P[];
  selected: PeriodChoice<P>;
  onChange: (choice: PeriodChoice<P>) => void;
  info: PeriodInfo;
  t: Pick<Dict, "periodLabel" | "periodOption" | "periodRangeCaption" | "allTime" | "monthPickerLabel" | "monthInProgress" | "wholeMonth">;
  locale: string;
  note?: string;
}) {
  const months = info.months;
  const currentMonth = months[0] ?? null;
  let caption = t.allTime;
  if (info.isPast && info.month) caption = t.wholeMonth(monthName(info.month, locale));
  else if (info.key !== "todo")
    caption = t.periodRangeCaption(
      new Date(info.startIso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "America/Hermosillo" })
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodFilter
          periods={periods}
          selected={selected.period}
          onChange={(period) => onChange({ period, month: period === "mes" ? currentMonth : null })}
          label={t.periodLabel}
          options={t.periodOption}
        />
        {selected.period === "mes" && months.length > 1 && (
          <select
            aria-label={t.monthPickerLabel}
            value={selected.month ?? currentMonth ?? ""}
            onChange={(e) => onChange({ period: selected.period, month: e.target.value })}
            className="h-10 rounded-full px-4 text-sm font-medium cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)]"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline)",
              boxShadow: "var(--card-shadow)",
              color: "var(--text-primary)",
            }}
          >
            {months.map((m, i) => (
              <option key={m} value={m}>
                {monthName(m, locale)}
                {i === 0 ? ` ${t.monthInProgress}` : ""}
              </option>
            ))}
          </select>
        )}
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {caption}
        </span>
      </div>
      {note && <InfoNote>{note}</InfoNote>}
    </div>
  );
}
