import { Icon, type IconName } from "@/components/icons";

const ACCENT_COLOR = {
  neutral: "var(--series-1)",
  good: "var(--status-good)",
  warning: "var(--status-warning)",
} as const;

export type Comparison = { pct: number | null; caption: string; higherIsBetter?: boolean };

function DeltaChip({ pct, higherIsBetter = true }: { pct: number; higherIsBetter?: boolean }) {
  const better = higherIsBetter ? pct > 0 : pct < 0;
  const tone = pct === 0 ? "var(--baseline)" : better ? "var(--status-good)" : "var(--status-warning)";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums shrink-0"
      style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: "var(--text-primary)" }}
    >
      <Icon name={pct > 0 ? "arrowUp" : pct < 0 ? "arrowDown" : "arrowUpDown"} size={12} style={{ color: tone }} />
      {Math.abs(Math.round(pct * 100))}%
    </span>
  );
}

export function StatTile({
  label,
  value,
  sublabel,
  delta,
  comparisons = [],
  accent = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  delta?: { pct: number; caption: string } | null;
  /** Extra comparison rows (e.g. vs. last week and vs. last month); `pct` null shows the caption alone. */
  comparisons?: Comparison[];
  accent?: "neutral" | "good" | "warning";
  icon?: IconName;
}) {
  const color = ACCENT_COLOR[accent];
  const deltaTone =
    delta == null ? null : delta.pct > 0 ? "var(--status-good)" : delta.pct < 0 ? "var(--status-warning)" : "var(--baseline)";

  return (
    <div
      className="stat-tile relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: `radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, ${color} 9%, transparent) 0%, transparent 55%), var(--surface-1)`,
        border: "1px solid var(--border-hairline)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium leading-snug" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        {icon && (
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
          >
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {delta != null && deltaTone && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full tabular-nums"
            style={{ background: `color-mix(in srgb, ${deltaTone} 16%, transparent)`, color: "var(--text-primary)" }}
          >
            <Icon name={delta.pct > 0 ? "arrowUp" : delta.pct < 0 ? "arrowDown" : "arrowUpDown"} size={12} style={{ color: deltaTone }} />
            {Math.abs(Math.round(delta.pct * 100))}%
          </span>
        )}
      </div>

      {comparisons.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {comparisons.map((c) => (
            <div key={c.caption} className="flex items-center gap-2">
              {c.pct !== null && <DeltaChip pct={c.pct} higherIsBetter={c.higherIsBetter} />}
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {c.caption}
              </span>
            </div>
          ))}
        </div>
      )}

      {(sublabel || delta) && (
        <div className="flex flex-col gap-0.5 mt-auto">
          {sublabel && (
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {sublabel}
            </span>
          )}
          {delta != null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {delta.caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
