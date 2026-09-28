"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import type { Lang } from "@/lib/i18n";
import { DEAD_BUCKETS, QUOTED_BUCKETS, type FieldLabels, type LeadNote, type LeadRow } from "@/lib/leads";
import { formatMinutes } from "@/lib/metrics";
import { AppHeader, usePrefs, type Dict, type Theme } from "@/components/AppHeader";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/Panel";

export type LeadFilters = { stage: string | null; line: string | null; tag: string | null; useCase: string | null };

export type LeadsViewProps = {
  companyName: string;
  generatedAtIso: string;
  currency: string;
  rows: LeadRow[];
  fieldLabels: FieldLabels;
  initialFilters: LeadFilters;
  initialLang: Lang;
  initialTheme: Theme;
};

type SortKey = "newest" | "value" | "stalled";

const ALL = "__all__";

function countBy<T>(items: T[], keysOf: (item: T) => string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) for (const k of keysOf(it)) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function syncUrl(filters: LeadFilters) {
  const params = new URLSearchParams();
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

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: [string, string][];
  allLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs min-w-0" style={{ color: "var(--text-muted)" }}>
      {label}
      <select
        value={value ?? ALL}
        onChange={(e) => onChange(e.target.value === ALL ? null : e.target.value)}
        className="text-sm rounded-lg px-2.5 py-2 outline-none cursor-pointer w-full"
        style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--border-hairline)" }}
      >
        {allLabel && <option value={ALL}>{allLabel}</option>}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
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
  const { companyName, generatedAtIso, currency, rows, fieldLabels, initialFilters, initialLang, initialTheme } = props;
  const prefs = usePrefs(initialLang, initialTheme);
  const { t, locale } = prefs;

  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, NotesState>>({});

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  function updateFilter<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    syncUrl(next);
  }

  function clearAll() {
    const next = { stage: null, line: null, tag: null, useCase: null };
    setFilters(next);
    setQuery("");
    syncUrl(next);
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

  // Everything except the stage filter, so the stage chips can show counts.
  const baseFiltered = useMemo(() => {
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

  const stageCounts = useMemo(() => new Map(countBy(baseFiltered, (r) => (r.stage ? [r.stage] : []))), [baseFiltered]);

  const visible = useMemo(() => {
    const list = filters.stage ? baseFiltered.filter((r) => r.stage === filters.stage) : baseFiltered;
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    if (sort === "value") sorted.sort((a, b) => b.value - a.value || b.dateAdded.localeCompare(a.dateAdded));
    if (sort === "stalled") sorted.sort((a, b) => (b.daysInStage ?? -1) - (a.daysInStage ?? -1));
    return sorted;
  }, [baseFiltered, filters.stage, sort]);

  const quoted = visible.filter((r) => QUOTED_BUCKETS.includes(r.bucket) || (r.bucket === "lost" && r.value > 0));
  const won = visible.filter((r) => r.bucket === "won");
  const cost = visible.reduce((s, r) => s + r.estCost, 0);
  const paidCount = visible.filter((r) => r.estCost > 0).length;
  const hasFilters = !!(filters.stage || filters.line || filters.tag || filters.useCase || query);

  const chipStyle = (active: boolean) => ({
    color: active ? "#ffffff" : "var(--text-secondary)",
    background: active ? "var(--series-1)" : "var(--surface-1)",
    border: "1px solid var(--border-hairline)",
  });

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--page-plane)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-10 py-10 flex flex-col gap-8">
        <AppHeader companyName={companyName} subtitle={t.leadsSubtitle} generatedAtIso={generatedAtIso} prefs={prefs} />

        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs col-span-2 lg:col-span-1" style={{ color: "var(--text-muted)" }}>
              {t.search}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="text-sm rounded-lg px-3 py-2 outline-none w-full"
                style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--border-hairline)" }}
              />
            </label>
            <Select
              label={t.filterLine}
              value={filters.line}
              onChange={(v) => updateFilter("line", v)}
              allLabel={t.allF}
              options={lineOptions.map(([l, n]) => [l, `${t.line[l] ?? l} (${n})`])}
            />
            <Select
              label={t.filterUseCase}
              value={filters.useCase}
              onChange={(v) => updateFilter("useCase", v)}
              allLabel={t.allM}
              options={useCaseOptions.map(([u, n]) => [u, `${u} (${n})`])}
            />
            <Select
              label={t.filterTag}
              value={filters.tag}
              onChange={(v) => updateFilter("tag", v)}
              allLabel={t.allF}
              options={tagOptions.map(([tag, n]) => [tag, `${tag} (${n})`])}
            />
            <Select
              label={t.sortLabel}
              value={sort}
              onChange={(v) => setSort((v as SortKey) ?? "newest")}
              options={[
                ["newest", t.sortNewest],
                ["value", t.sortValue],
                ["stalled", t.sortStalled],
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t.filterStage}
            </span>
            <ToggleGroup.Root
              type="single"
              value={filters.stage ?? ALL}
              onValueChange={(next) => next && updateFilter("stage", next === ALL ? null : next)}
              aria-label={t.filterStage}
              className="inline-flex flex-wrap gap-1.5"
            >
              <ToggleGroup.Item
                value={ALL}
                className="text-xs font-medium px-3 py-1.5 rounded-full outline-none cursor-pointer"
                style={chipStyle(filters.stage === null)}
              >
                {t.allF} ({baseFiltered.length})
              </ToggleGroup.Item>
              {stageOptions.map((s) => (
                <ToggleGroup.Item
                  key={s}
                  value={s}
                  className="text-xs font-medium px-3 py-1.5 rounded-full outline-none cursor-pointer"
                  style={chipStyle(filters.stage === s)}
                >
                  {s} ({stageCounts.get(s) ?? 0})
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t.resultCount(visible.length, rows.length)}
            </span>
            {hasFilters && (
              <button onClick={clearAll} className="text-xs underline cursor-pointer" style={{ color: "var(--text-muted)" }}>
                {t.clearFilters}
              </button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile label={t.selQuoted} value={money(quoted.reduce((s, r) => s + r.value, 0))} sublabel={t.selQuotedCount(quoted.length)} />
          <StatTile label={t.selWon} value={money(won.reduce((s, r) => s + r.value, 0))} sublabel={t.selWonCount(won.length)} accent="good" />
          <StatTile
            label={t.selCost}
            value={money(cost)}
            sublabel={paidCount > 0 ? t.selCpl(money(cost / paidCount)) : undefined}
          />
        </section>

        <Panel>
          {visible.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
              {t.noResults}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--text-secondary)" }}>
                  <th className="text-left font-normal pb-2 pr-3">{t.nameCol}</th>
                  <th className="text-left font-normal pb-2 pr-3">{t.stageCol}</th>
                  <th className="text-left font-normal pb-2 pr-3 hidden md:table-cell">{t.useCaseCol}</th>
                  <th className="text-right font-normal pb-2 pl-3 whitespace-nowrap" title={t.valueColHint}>
                    <span className="underline decoration-dotted underline-offset-4 cursor-help">{t.valueCol}</span>
                  </th>
                  <th className="text-right font-normal pb-2 pl-3 hidden sm:table-cell whitespace-nowrap">{t.daysInStageCol}</th>
                  <th className="text-right font-normal pb-2 pl-3 hidden md:table-cell">{t.createdCol}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const open = openId === r.id;
                  const stalled = (r.bucket === "quoted" || r.bucket === "negotiation") && (r.daysInStage ?? 0) >= 14;
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
                        className="cursor-pointer outline-none"
                        style={{
                          borderTop: "1px solid var(--gridline)",
                          background: open ? "color-mix(in srgb, var(--series-1) 7%, transparent)" : undefined,
                        }}
                      >
                        <td className="py-2.5 pr-3 align-top">
                          <div className="flex items-start gap-2">
                            <span className="text-xs mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden>
                              {open ? "▾" : "▸"}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[220px]" style={{ color: "var(--text-primary)" }}>
                                {r.name}
                              </div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {t.line[r.line] ?? r.line}
                                {r.city ? ` · ${r.city}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 align-top">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                            <StatusDot row={r} />
                            {r.stage ?? t.bucket.other}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 align-top hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                          <span className="block max-w-[200px] truncate" title={r.useCase.join(", ")}>
                            {r.useCase.join(", ") || t.noValue}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums align-top whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {r.value > 0 ? money(r.value) : t.noValue}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums align-top hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {stalled && (
                              <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
                            )}
                            {r.daysInStage != null ? t.daysShort(Math.floor(r.daysInStage)) : t.noValue}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums align-top hidden md:table-cell whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {new Date(r.dateAdded).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "America/Hermosillo" })}
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
      </div>
    </div>
  );
}
