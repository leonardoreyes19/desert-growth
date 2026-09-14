export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-base sm:text-lg font-semibold mb-3"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </h3>
  );
}
