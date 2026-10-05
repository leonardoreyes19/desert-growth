"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToggleGroup } from "radix-ui";
import type { PeriodKey } from "@/lib/periods";
import type { Dict } from "@/components/AppHeader";

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

/**
 * Switches the page's `periodo` URL param (keeping every other param) with a
 * server navigation, and reports the requested period while it loads.
 */
export function usePeriodSwitch<P extends PeriodKey>(period: P, defaultPeriod: P) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(period);

  function change(next: P) {
    const params = new URLSearchParams(window.location.search);
    if (next === defaultPeriod) params.delete("periodo");
    else params.set("periodo", next);
    const query = params.toString();
    setRequested(next);
    startTransition(() => router.push(query ? `${window.location.pathname}?${query}` : window.location.pathname));
  }

  return { pending, shown: pending ? requested : period, change };
}

/** The period control plus a caption saying which dates are on screen. */
export function PeriodBar<P extends PeriodKey>({
  periods,
  selected,
  onChange,
  periodStartIso,
  t,
  locale,
  note,
}: {
  periods: P[];
  selected: P;
  onChange: (period: P) => void;
  periodStartIso: string | null;
  t: Pick<Dict, "periodLabel" | "periodOption" | "periodRangeCaption" | "allTime">;
  locale: string;
  note?: string;
}) {
  const caption = periodStartIso
    ? t.periodRangeCaption(
        new Date(periodStartIso).toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "short",
          timeZone: "America/Hermosillo",
        })
      )
    : t.allTime;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodFilter periods={periods} selected={selected} onChange={onChange} label={t.periodLabel} options={t.periodOption} />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {caption}
        </span>
      </div>
      {note && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
