import "server-only";
import { after } from "next/server";

/**
 * Small in-memory stale-while-revalidate cache for the GHL / Meta pulls.
 *
 * Pulling everything from GHL takes ~6 s (contacts come 100 at a time, one
 * page after another), and every tab switch or tag click re-renders the page
 * on the server. Within FRESH_MS the last result is reused as-is; up to
 * STALE_MS it's served immediately and refreshed after the response is sent.
 * Past that (or on a cold instance) the request waits for fresh data.
 *
 * It's per server instance, which is fine here: Vercel Fluid Compute reuses
 * warm instances, and a miss only means one slow load.
 */

const FRESH_MS = 60 * 1000;
const STALE_MS = 5 * 60 * 1000;

type Entry = { value?: unknown; fetchedAt: number; pending?: Promise<unknown> };
const store = new Map<string, Entry>();

export async function cached<T>(key: string, load: () => Promise<T>, opts: { keep?: (value: T) => boolean } = {}): Promise<T> {
  const entry = store.get(key);
  const age = entry && entry.value !== undefined ? Date.now() - entry.fetchedAt : Infinity;

  const refresh = (): Promise<T> => {
    const current = store.get(key);
    if (current?.pending) return current.pending as Promise<T>;
    const pending = load()
      .then((value) => {
        if (opts.keep?.(value) === false) store.delete(key);
        else store.set(key, { value, fetchedAt: Date.now() });
        return value;
      })
      .catch((err) => {
        // Keep serving the last good value if there is one; otherwise surface the error.
        const prev = store.get(key);
        if (prev) store.set(key, { value: prev.value, fetchedAt: prev.fetchedAt });
        throw err;
      });
    store.set(key, { ...current, fetchedAt: current?.fetchedAt ?? 0, pending });
    return pending;
  };

  if (age < FRESH_MS) return entry!.value as T;
  if (age < STALE_MS) {
    try {
      after(() => refresh().catch((err) => console.error(`Background refresh of ${key} failed`, err)));
    } catch {
      refresh().catch((err) => console.error(`Background refresh of ${key} failed`, err));
    }
    return entry!.value as T;
  }
  return refresh();
}
