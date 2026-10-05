import { stageOutcome } from "./metrics";
import type { OppEvent, OppEventLog } from "./opportunity-events";

/** Stages that mean a quote went out (or the deal got past that point). */
export const QUOTED_OR_LATER_RE = /cotizaci|negociaci|ganad/i;
/** Stages that mean the lead never engaged (or was dropped). */
const NOT_ANSWERED_RE = /lead nuevo|sin respuesta|perdid|descalificad/i;

/** Moves undone within this long (e.g. bulk-moving deals to another stage and straight back) aren't real changes. */
const BOUNCE_MS = 10 * 60 * 1000;

/**
 * Drops round trips: when a deal leaves a stage and is back in it within
 * BOUNCE_MS, the detour never happened. Someone has been bulk-moving deals to
 * "En negociación" and back, which otherwise looks like dozens of quotes and
 * resets every deal's "days in stage".
 */
export function withoutBounces(events: OppEvent[]): OppEvent[] {
  const out: OppEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const prev = out[out.length - 1];
    const e = events[i];
    if (prev && e.stage !== prev.stage && !e.deleted) {
      // Look for a return to prev's stage (and outcome) shortly after leaving it.
      let j = i + 1;
      while (j < events.length && events[j].t - e.t <= BOUNCE_MS && events[j].stage !== prev.stage) j++;
      if (j < events.length && events[j].t - e.t <= BOUNCE_MS && events[j].status === prev.status) {
        i = j; // skip the detour and the return
        continue;
      }
    }
    out.push(e);
  }
  return out;
}

export type StateAt = {
  stage: string;
  status: string;
  outcome: "won" | "lost" | "open";
  /** When it entered `stage` (start of the unbroken run of events in that stage). */
  stageSince: number;
  /** When it reached `outcome` (e.g. the moment it was won or lost). */
  outcomeSince: number;
};

/** The opportunity as it stood just before time `t`; null if it didn't exist yet or was deleted. */
export function stateAt(events: OppEvent[], t: number): StateAt | null {
  let i = -1;
  while (i + 1 < events.length && events[i + 1].t < t) i++;
  if (i < 0 || events[i].deleted) return null;
  const current = events[i];
  const outcome = stageOutcome(current.stage, current.status);
  let stageSince = current.t;
  for (let k = i - 1; k >= 0 && events[k].stage === current.stage; k--) stageSince = events[k].t;
  let outcomeSince = current.t;
  for (let k = i - 1; k >= 0 && stageOutcome(events[k].stage, events[k].status) === outcome; k--) outcomeSince = events[k].t;
  return { stage: current.stage, status: current.status, outcome, stageSince, outcomeSince };
}

function firstMatch(events: OppEvent[], matches: (e: OppEvent) => boolean): number | null {
  for (const e of events) if (!e.deleted && matches(e)) return e.t;
  return null;
}

/** First time it reached Cotización enviada (or En negociación / Ganado). */
export function quotedAt(events: OppEvent[]): number | null {
  return firstMatch(events, (e) => QUOTED_OR_LATER_RE.test(e.stage));
}

/** First time it moved past Lead nuevo / Sin respuesta into a stage where we're talking to the lead. */
export function answeredAt(events: OppEvent[]): number | null {
  return firstMatch(events, (e) => e.stage !== "" && !NOT_ANSWERED_RE.test(e.stage));
}

/** When it was won or lost, if it's closed now. */
export function closedAt(events: OppEvent[], now = Date.now()): number | null {
  const s = stateAt(events, now + 1);
  return s && s.outcome !== "open" ? s.outcomeSince : null;
}

export type OpportunityTiming = { stageSince: number; closedAt: number | null };

/** Per opportunity id: when it really entered its current stage and when it closed, bounces ignored. */
export function opportunityTiming(log: OppEventLog, now = Date.now()): Map<string, OpportunityTiming> {
  const timing = new Map<string, OpportunityTiming>();
  for (const [id, raw] of Object.entries(log)) {
    const s = stateAt(withoutBounces(raw), now + 1);
    if (s) timing.set(id, { stageSince: s.stageSince, closedAt: s.outcome === "open" ? null : s.outcomeSince });
  }
  return timing;
}
