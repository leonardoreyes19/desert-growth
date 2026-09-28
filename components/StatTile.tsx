import { Icon, type IconName } from "@/components/icons";

const ACCENT_COLOR = {
  neutral: "var(--series-1)",
  good: "var(--status-good)",
  warning: "var(--status-warning)",
} as const;

export function StatTile({
  label,
  value,
  sublabel,
  delta,
  accent = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  delta?: { pct: number; caption: string } | null;
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
