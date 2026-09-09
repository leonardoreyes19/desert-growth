export function StatTile({
  label,
  value,
  sublabel,
  delta,
  accent = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: string;
  delta?: { pct: number; caption: string } | null;
  accent?: "neutral" | "good" | "warning";
}) {
  const deltaColor =
    delta == null
      ? undefined
      : delta.pct > 0
        ? "var(--status-good)"
        : delta.pct < 0
          ? "var(--status-warning-ink, var(--text-secondary))"
          : "var(--text-secondary)";

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-hairline)",
        boxShadow: "var(--card-shadow)",
        borderTop: accent === "good" ? "3px solid var(--status-good)" : accent === "warning" ? "3px solid var(--status-warning)" : "3px solid transparent",
      }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {delta != null && (
          <span className="text-sm font-medium" style={{ color: deltaColor }}>
            {delta.pct > 0 ? "▲" : delta.pct < 0 ? "▼" : "—"} {Math.abs(Math.round(delta.pct * 100))}%
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sublabel}
        </span>
      )}
      {delta != null && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {delta.caption}
        </span>
      )}
    </div>
  );
}
