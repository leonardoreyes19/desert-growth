export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-wide mb-3"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </h2>
  );
}
