"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import type { Lang } from "@/lib/i18n";
import { DEAD_BUCKETS, QUOTED_BUCKETS, STALLED_DAYS, isStalled, type FieldLabels, type LeadNote, type LeadRow } from "@/lib/leads";
import { formatMinutes } from "@/lib/metrics";
import { AppHeader, usePrefs, type Dict, type Theme } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { FilterSelect } from "@/components/FilterSelect";
import { PeriodBar, usePeriodSwitch } from "@/components/PeriodFilter";
import { DEFAULT_TAB_PERIOD, TAB_PERIODS, type PeriodInfo } from "@/lib/periods";
import { Icon } from "@/components/icons";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/Panel";

export type LeadFilters = {
  stage: string | null;
  line: string | null;
  tag: string | null;
  useCase: string | null;
  /** "1" to show only stalled leads. */
  stalled: string | null;
};

export type LeadsViewProps = {
  companyName: string;
  generatedAtIso: string;
  currency: string;
  rows: LeadRow[];
  periodInfo: PeriodInfo;
  fieldLabels: FieldLabels;
  initialFilters: LeadFilters;
  initialLang: Lang;
  initialTheme: Theme;
};

type SortKey = "dateAdded" | "value" | "daysInStage" | "name" | "stage" | "useCase";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

// First click on a column: numbers and dates start high → low, text A → Z.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  dateAdded: "desc",
  value: "desc",
  daysInStage: "desc",
  name: "asc",
  stage: "asc",
  useCase: "asc",
};

const collator = new Intl.Collator("es", { sensitivity: "base" });

function compareRows(a: LeadRow, b: LeadRow, key: SortKey): number {
  switch (key) {
    case "dateAdded":
      return a.dateAdded.localeCompare(b.dateAdded);
    case "value":
      return a.value - b.value;
    case "daysInStage":
      return (a.daysInStage ?? -1) - (b.daysInStage ?? -1);
    case "name":
      return collator.compare(a.name, b.name);
    case "stage":
      return a.stagePosition - b.stagePosition;
    case "useCase":
      return collator.compare(a.useCase.join(", "), b.useCase.join(", "));
  }
}

// Leads with no value for the sorted column (no quote yet, no answer…) always
// sink to the bottom, in either direction.
function hasValue(r: LeadRow, key: SortKey): boolean {
  if (key === "value") return r.value > 0;
  if (key === "daysInStage") return r.daysInStage != null;
  if (key === "useCase") return r.useCase.length > 0;
  if (key === "stage") return r.stage != null;
  return true;
}

function sortRows(rows: LeadRow[], sort: Sort): LeadRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ha = hasValue(a, sort.key);
    const hb = hasValue(b, sort.key);
    if (ha !== hb) return ha ? -1 : 1;
    return sign * compareRows(a, b, sort.key) || b.dateAdded.localeCompare(a.dateAdded);
  });
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
  hint,
  t,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
  hint?: string;
  t: Dict;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`font-medium pb-3 whitespace-nowrap ${align === "right" ? "text-right pl-3" : "text-left pr-3"} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={hint ?? t.sortByColumn(label.toLowerCase())}
        className={`group inline-flex items-center gap-1.5 rounded-md -mx-1.5 px-1.5 py-1 cursor-pointer outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--series-1)] ${align === "right" ? "flex-row-reverse" : ""}`}
        style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
      >
        {label}
        <Icon
          name={active ? (sort.dir === "asc" ? "arrowUp" : "arrowDown") : "arrowUpDown"}
          size={13}
          className={active ? "" : "opacity-0 group-hover:opacity-60 transition-opacity"}
          style={{ color: active ? "var(--series-1)" : "currentColor" }}
        />
      </button>
    </th>
  );
}

const ALL = "__all__";

function countBy<T>(items: T[], keysOf: (item: T) => string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) for (const k of keysOf(it)) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function syncUrl(filters: LeadFilters) {
  const params = new URLSearchParams();
  // The period is server-side (it changes the rows and their costs), so keep it as-is.
  const period = new URLSearchParams(window.location.search).get("periodo");
  if (period) params.set("periodo", period);
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function StatusDot({ row }: { row: LeadRow }) {
  const color =
    row.bucket === "won"
      ? "var(--status-good)"
      : DEAD_BUCKETS.includes(row.bucket)
        ? "var(--status-warning)"
        : QUOTED_BUCKETS.includes(row.bucket)
          ? "var(--series-1)"
          : "var(--baseline)";
  return <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="text-sm break-words" style={{ color: "var(--text-primary)" }}>
        {children}
      </dd>
    </div>
  );
}

type NotesState = { status: "loading" } | { status: "error" } | { status: "ok"; notes: LeadNote[] };

function LeadDetail({
  row,
  notes,
  t,
  locale,
  money,
  fieldLabels,
}: {
  row: LeadRow;
  notes: NotesState | undefined;
  t: Dict;
  locale: string;
  money: (n: number) => string;
  fieldLabels: FieldLabels;
}) {
  const dash = t.noValue;
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Hermosillo" });
  const waNumber = row.phone?.replace(/\D/g, "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 py-4">
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label={t.fieldStage}>
            {row.stage ?? dash}
            {row.pipelineName ? <span style={{ color: "var(--text-muted)" }}> · {row.pipelineName}</span> : null}
          </Field>
          <Field label={t.valueCol}>{row.value > 0 ? money(row.value) : dash}</Field>
          <Field label={fieldLabels.useCase ?? t.fieldUseCase}>{row.useCase.length ? row.useCase.join(", ") : dash}</Field>
          <Field label={fieldLabels.batteryQty ?? t.fieldBatteryQty}>{row.batteryQtyRaw ?? dash}</Field>
          <Field label={fieldLabels.problem ?? t.fieldProblem}>{row.problem ?? dash}</Field>
          <Field label={fieldLabels.equipment ?? t.fieldEquipment}>{row.equipment ?? dash}</Field>
          <Field label={t.fieldPhone}>{row.phone ?? dash}</Field>
          <Field label={t.fieldEmail}>{row.email ?? dash}</Field>
          <Field label={t.fieldCity}>{row.city ?? dash}</Field>
          <Field label={t.fieldCreated}>{dateFmt(row.dateAdded)}</Field>
          <Field label={t.fieldChannel}>{row.channel}</Field>
          <Field label={t.fieldCampaign}>{row.campaignName ?? row.campaignId ?? dash}</Field>
          <Field label={t.fieldAd}>{row.adName ?? row.adId ?? dash}</Field>
          <Field label={t.fieldEstCost}>{row.estCost > 0 ? money(row.estCost) : dash}</Field>
          <Field label={t.fieldFirstResponse}>
            {row.firstResponseMinutes != null ? formatMinutes(row.firstResponseMinutes) : dash}
          </Field>
          <Field label={t.fieldTags}>{row.tags.length ? row.tags.join(", ") : dash}</Field>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a
            href={row.ghlUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ background: "var(--series-1)", color: "#ffffff" }}
          >
            {t.openInGhl} ↗
          </a>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
            >
              {t.whatsapp} ↗
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {t.notesTitle}
        </h4>
        {!notes || notes.status === "loading" ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t.notesLoading}
          </p>
        ) : notes.status === "error" ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t.notesError}
          </p>
        ) : notes.notes.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t.notesEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.notes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl px-3 py-2"
                style={{ background: "var(--page-plane)", border: "1px solid var(--border-hairline)" }}
              >
                <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
                  {n.text}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {dateFmt(n.dateAdded)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LeadsView(props: LeadsViewProps) {
  const { companyName, generatedAtIso, currency, rows, periodInfo: info, fieldLabels, initialFilters, initialLang, initialTheme } =
    props;
  const prefs = usePrefs(initialLang, initialTheme);
  const { t, locale } = prefs;
  const periodSwitch = usePeriodSwitch({ period: info.key, month: info.month }, DEFAULT_TAB_PERIOD, info.months[0] ?? null);

  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(
    initialFilters.stalled ? { key: "daysInStage", dir: "desc" } : { key: "dateAdded", dir: "desc" }
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, NotesState>>({});

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  function updateFilter<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    syncUrl(next);
  }

  function clearAll() {
    const next = { stage: null, line: null, tag: null, useCase: null, stalled: null };
    setFilters(next);
    setQuery("");
    syncUrl(next);
  }

  function sortBy(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }
    );
  }

  function toggleRow(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !notes[next]) {
      setNotes((prev) => ({ ...prev, [next]: { status: "loading" } }));
      fetch(`/api/leads/${next}/notes`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: LeadNote[]) => setNotes((prev) => ({ ...prev, [next]: { status: "ok", notes: data } })))
        .catch(() => setNotes((prev) => ({ ...prev, [next]: { status: "error" } })));
    }
  }

  const stageOptions = useMemo(() => {
    const pos = new Map<string, number>();
    for (const r of rows) if (r.stage) pos.set(r.stage, Math.min(pos.get(r.stage) ?? 999, r.stagePosition));
    return [...pos.entries()].sort((a, b) => a[1] - b[1]).map(([s]) => s);
  }, [rows]);
  const lineOptions = useMemo(() => countBy(rows, (r) => (r.stage ? [r.line] : [])), [rows]);
  const tagOptions = useMemo(() => countBy(rows, (r) => r.tags), [rows]);
  const useCaseOptions = useMemo(() => countBy(rows, (r) => r.useCase), [rows]);

  function toggleStalled() {
    const on = !filters.stalled;
    updateFilter("stalled", on ? "1" : null);
    if (on) setSort({ key: "daysInStage", dir: "desc" });
  }

  // Everything except the stage and stalled filters, so their chips can show counts.
  const unstalledFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.line && r.line !== filters.line) return false;
      if (filters.tag && !r.tags.includes(filters.tag)) return false;
      if (filters.useCase && !r.useCase.includes(filters.useCase)) return false;
      if (q) {
        const hay = [r.name, r.phone, r.email, r.city, r.problem, r.equipment, r.batteryQtyRaw, r.adName, ...r.useCase, ...r.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters.line, filters.tag, filters.useCase, query]);

  const stalledCount = useMemo(() => unstalledFiltered.filter(isStalled).length, [unstalledFiltered]);
  const baseFiltered = useMemo(
    () => (filters.stalled ? unstalledFiltered.filter(isStalled) : unstalledFiltered),
    [unstalledFiltered, filters.stalled]
  );

  const stageCounts = useMemo(() => new Map(countBy(baseFiltered, (r) => (r.stage ? [r.stage] : []))), [baseFiltered]);

  const visible = useMemo(
    () => sortRows(filters.stage ? baseFiltered.filter((r) => r.stage === filters.stage) : baseFiltered, sort),
    [baseFiltered, filters.stage, sort]
  );

  // With a period: quotes and sales that happened in it, and the cost of the leads that arrived in it.
  const windowStart = info.key === "todo" ? -Infinity : new Date(info.startIso).getTime();
  const windowEnd = info.endIso ? new Date(info.endIso).getTime() : Infinity;
  const inPeriod = (iso: string | null) => iso !== null && new Date(iso).getTime() >= windowStart && new Date(iso).getTime() < windowEnd;
  const quoted = visible.filter((r) => inPeriod(r.quotedAt));
  const won = visible.filter((r) => r.bucket === "won" && inPeriod(r.closedAt));
  const arrived = visible.filter((r) => inPeriod(r.dateAdded));
  const cost = arrived.reduce((s, r) => s + r.estCost, 0);
  const paidCount = arrived.filter((r) => r.estCost > 0).length;
  const activeCount = [filters.stage, filters.line, filters.tag, filters.useCase, filters.stalled, query.trim() || null].filter(Boolean).length;

  const sortOptions: { value: string; label: string }[] = [
    { value: "dateAdded:desc", label: t.sortNewest },
    { value: "dateAdded:asc", label: t.sortOldest },
    { value: "value:desc", label: t.sortValue },
    { value: "value:asc", label: t.sortValueAsc },
    { value: "daysInStage:desc", label: t.sortStalled },
    { value: "daysInStage:asc", label: t.sortStalledAsc },
    { value: "name:asc", label: t.sortNameAsc },
    { value: "name:desc", label: t.sortNameDesc },
    { value: "stage:asc", label: t.sortStageAsc },
    { value: "stage:desc", label: t.sortStageDesc },
    { value: "useCase:asc", label: t.sortUseCaseAsc },
    { value: "useCase:desc", label: t.sortUseCaseDesc },
  ];

  const chipStyle = (active: boolean) => ({
    color: active ? "#ffffff" : "var(--text-secondary)",
    background: active ? "var(--series-1)" : "var(--surface-1)",
    border: `1px solid ${active ? "var(--series-1)" : "var(--border-hairline)"}`,
    boxShadow: active ? "0 2px 8px color-mix(in srgb, var(--series-1) 35%, transparent)" : "0 1px 2px rgba(11,11,11,0.04)",
  });
  const chipCountStyle = (active: boolean) => ({
    background: active ? "rgba(255,255,255,0.22)" : "color-mix(in srgb, var(--text-primary) 7%, transparent)",
    color: active ? "#ffffff" : "var(--text-muted)",
  });
  const chipClass = "inline-flex items-center gap-1.5 text-xs font-medium pl-3 pr-1.5 py-1.5 rounded-full outline-none cursor-pointer transition-all hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--series-1)]";

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: "var(--page-plane)" }}>
      <AppHeader companyName={companyName} title={t.leadsTitle} subtitle={t.leadsSubtitle} generatedAtIso={generatedAtIso} prefs={prefs} />

      <main
        className="max-w-6xl mx-auto w-full px-4 sm:px-10 py-8 flex flex-col gap-6 flex-1 transition-opacity"
        style={{ opacity: periodSwitch.pending ? 0.55 : 1, cursor: periodSwitch.pending ? "progress" : undefined }}
        aria-busy={periodSwitch.pending}
      >
        <PeriodBar
          periods={TAB_PERIODS}
          selected={periodSwitch.shown}
          onChange={periodSwitch.change}
          info={info}
          t={t}
          locale={locale}
        />
        <section
          className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-end">
            <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
              <label htmlFor="lead-search" className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {t.search}
              </label>
              <div
                className="h-10 rounded-xl flex items-center gap-2 px-3 transition-all focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--series-1)_45%,transparent)]"
                style={{ background: "var(--page-plane)", border: "1px solid var(--border-hairline)" }}
              >
                <Icon name="search" size={15} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                <input
                  id="lead-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={t.clearSearch}
                    className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer shrink-0 hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
            </div>
            <FilterSelect
              label={t.filterLine}
              icon="zap"
              value={filters.line}
              onChange={(v) => updateFilter("line", v)}
              allLabel={t.allF}
              options={lineOptions.map(([l, n]) => ({ value: l, label: t.line[l] ?? l, count: n }))}
            />
            <FilterSelect
              label={t.filterUseCase}
              icon="users"
              value={filters.useCase}
              onChange={(v) => updateFilter("useCase", v)}
              allLabel={t.allM}
              options={useCaseOptions.map(([u, n]) => ({ value: u, label: u, count: n }))}
            />
            <FilterSelect
              label={t.filterTag}
              icon="tag"
              value={filters.tag}
              onChange={(v) => updateFilter("tag", v)}
              allLabel={t.allF}
              options={tagOptions.map(([tag, n]) => ({ value: tag, label: tag, count: n }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {t.filterStage}
              </span>
              <button
                type="button"
                onClick={toggleStalled}
                aria-pressed={filters.stalled !== null}
                className={chipClass}
                style={
                  filters.stalled
                    ? { ...chipStyle(true), background: "var(--status-warning)", border: "1px solid var(--status-warning)" }
                    : chipStyle(false)
                }
              >
                <Icon name="pause" size={13} />
                {t.onlyStalled(STALLED_DAYS)}
                <span className="px-1.5 py-0.5 rounded-full text-[11px] tabular-nums" style={chipCountStyle(filters.stalled !== null)}>
                  {stalledCount}
                </span>
              </button>
            </div>
            <ToggleGroup.Root
              type="single"
              value={filters.stage ?? ALL}
              onValueChange={(next) => next && updateFilter("stage", next === ALL ? null : next)}
              aria-label={t.filterStage}
              className="flex flex-wrap gap-2"
            >
              <ToggleGroup.Item value={ALL} className={chipClass} style={chipStyle(filters.stage === null)}>
                {t.allF}
                <span className="px-1.5 py-0.5 rounded-full text-[11px] tabular-nums" style={chipCountStyle(filters.stage === null)}>
                  {baseFiltered.length}
                </span>
              </ToggleGroup.Item>
              {stageOptions.map((s) => (
                <ToggleGroup.Item key={s} value={s} className={chipClass} style={chipStyle(filters.stage === s)}>
                  {s}
                  <span className="px-1.5 py-0.5 rounded-full text-[11px] tabular-nums" style={chipCountStyle(filters.stage === s)}>
                    {stageCounts.get(s) ?? 0}
                  </span>
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>

          <div className="flex flex-col gap-3 pt-3" style={{ borderTop: "1px solid var(--gridline)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 min-h-8">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {t.resultCount(visible.length, rows.length)}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-8 inline-flex items-center gap-2 pl-1.5 pr-2 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-all hover:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)]"
                  style={{
                    background: "color-mix(in srgb, var(--status-critical) 9%, var(--surface-1))",
                    border: "1px solid color-mix(in srgb, var(--status-critical) 28%, transparent)",
                    color: "var(--text-primary)",
                  }}
                  title={t.activeFilters(activeCount)}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--status-critical) 16%, transparent)", color: "var(--status-critical)" }}
                  >
                    <Icon name="x" size={12} />
                  </span>
                  {t.clearFilters}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[11px] tabular-nums"
                    style={{ background: "color-mix(in srgb, var(--text-primary) 8%, transparent)", color: "var(--text-secondary)" }}
                  >
                    {activeCount}
                  </span>
                </button>
              )}
            </div>
            <div className="md:hidden">
              <FilterSelect
                label={t.sortLabel}
                icon="arrowUpDown"
                value={`${sort.key}:${sort.dir}`}
                onChange={(v) => {
                  if (!v) return;
                  const [key, dir] = v.split(":") as [SortKey, SortDir];
                  setSort({ key, dir });
                }}
                options={sortOptions}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile
            icon="fileText"
            label={t.selQuoted}
            value={money(quoted.reduce((s, r) => s + r.value, 0))}
            sublabel={t.selQuotedCount(quoted.length)}
          />
          <StatTile
            icon="trophy"
            label={t.selWon}
            value={money(won.reduce((s, r) => s + r.value, 0))}
            sublabel={t.selWonCount(won.length)}
            accent="good"
          />
          <StatTile
            icon="wallet"
            label={t.selCost}
            value={money(cost)}
            sublabel={paidCount > 0 ? t.selCpl(money(cost / paidCount)) : undefined}
          />
        </section>

        <Panel>
          {visible.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--text-primary) 6%, transparent)", color: "var(--text-muted)" }}
              >
                <Icon name="search" size={20} />
              </span>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t.noResults}
              </p>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-sm font-medium cursor-pointer" style={{ color: "var(--series-1)" }}>
                  {t.clearFilters}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ borderBottom: "1px solid var(--gridline)" }}>
                  <SortableTh label={t.nameCol} sortKey="name" sort={sort} onSort={sortBy} t={t} />
                  <SortableTh label={t.stageCol} sortKey="stage" sort={sort} onSort={sortBy} t={t} className="hidden sm:table-cell" />
                  <SortableTh label={t.useCaseCol} sortKey="useCase" sort={sort} onSort={sortBy} t={t} className="hidden md:table-cell" />
                  <SortableTh label={t.valueCol} sortKey="value" sort={sort} onSort={sortBy} t={t} align="right" hint={t.valueColHint} />
                  <SortableTh label={t.daysInStageCol} sortKey="daysInStage" sort={sort} onSort={sortBy} t={t} align="right" className="hidden sm:table-cell" />
                  <SortableTh label={t.createdCol} sortKey="dateAdded" sort={sort} onSort={sortBy} t={t} align="right" className="hidden md:table-cell" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const open = openId === r.id;
                  const stalled = isStalled(r);
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => toggleRow(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(r.id);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={open}
                        aria-label={`${t.showDetails}: ${r.name}`}
                        className="cursor-pointer outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--series-1)_7%,transparent)]"
                        style={{
                          borderTop: "1px solid var(--gridline)",
                          background: open ? "color-mix(in srgb, var(--series-1) 7%, transparent)" : undefined,
                        }}
                      >
                        <td className="py-3 pr-3 align-top">
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-0.5 shrink-0 transition-transform"
                              style={{ color: "var(--text-muted)", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                              aria-hidden
                            >
                              <Icon name="chevronDown" size={14} />
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[180px] sm:max-w-[220px]" style={{ color: "var(--text-primary)" }}>
                                {r.name}
                              </div>
                              <div className="sm:hidden flex items-center gap-1.5 text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                <StatusDot row={r} />
                                {r.stage ?? t.bucket.other}
                              </div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {t.line[r.line] ?? r.line}
                                {r.city ? ` · ${r.city}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 align-top hidden sm:table-cell">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                            <StatusDot row={r} />
                            {r.stage ?? t.bucket.other}
                          </span>
                        </td>
                        <td className="py-3 pr-3 align-top hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                          <span className="block max-w-[200px] truncate" title={r.useCase.join(", ")}>
                            {r.useCase.join(", ") || t.noValue}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums align-top whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>
                          {r.value > 0 ? money(r.value) : <span style={{ color: "var(--text-muted)" }}>{t.noValue}</span>}
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums align-top hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {stalled && (
                              <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
                            )}
                            {r.daysInStage != null ? t.daysShort(Math.floor(r.daysInStage)) : t.noValue}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums align-top hidden md:table-cell whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {new Date(r.dateAdded).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Hermosillo" })}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="px-1 sm:px-6" style={{ borderTop: "1px dashed var(--gridline)" }}>
                            <LeadDetail row={r} notes={notes[r.id]} t={t} locale={locale} money={money} fieldLabels={fieldLabels} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </main>

      <AppFooter t={t} />
    </div>
  );
}
