/** Shown instantly while a tab's data loads (the first GHL pull on a cold server takes a few seconds). */
export default function Loading() {
  const block = { background: "color-mix(in srgb, var(--text-primary) 7%, transparent)" };
  return (
    <div className="w-full min-h-screen" style={{ background: "var(--page-plane)" }} aria-busy="true" aria-live="polite">
      <div className="h-16" style={{ borderBottom: "1px solid var(--border-hairline)" }} />
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-10 py-8 flex flex-col gap-6 animate-pulse">
        <div className="h-9 w-72 rounded-lg" style={block} />
        <div className="h-4 w-96 max-w-full rounded" style={block} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)" }}
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)" }} />
      </main>
    </div>
  );
}
