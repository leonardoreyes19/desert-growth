// Explicit extension so scripts/backfill-pipeline-history.ts can run this file directly under Node.
import { hermosilloDate, startOfWeek, type PipelineSnapshot } from "./metrics.ts";

/** Pipeline state stored per week (named by its Monday) and per month, as it stood at that period's close. */
export type StoredSnapshot = PipelineSnapshot & { recordedAt: string; reconstructed?: boolean };

export function weekPath(t: number) {
  return `pipeline/week/${hermosilloDate(startOfWeek(t))}.json`;
}

export function monthPath(monthStart: number) {
  return `pipeline/month/${hermosilloDate(monthStart).slice(0, 7)}.json`;
}
