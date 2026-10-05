import { BackgroundJob } from "@/models/BackgroundJob";

export const DEFAULT_STALE_HEARTBEAT_MS = 15 * 60 * 1000;

export type StaleBackgroundJobQuery = {
  runningWithOldHeartbeat: number;
  queuedNotDispatched: number;
  dispatchFailed: number;
};

/**
 * Query helpers only. Prompt 1 does not auto-fail or auto-repair stale jobs.
 */
export async function queryStaleBackgroundJobs(opts?: {
  staleHeartbeatMs?: number;
}): Promise<StaleBackgroundJobQuery> {
  const staleBefore = new Date(Date.now() - (opts?.staleHeartbeatMs ?? DEFAULT_STALE_HEARTBEAT_MS));
  const [runningWithOldHeartbeat, queuedNotDispatched, dispatchFailed] = await Promise.all([
    BackgroundJob.countDocuments({
      status: "running",
      $or: [{ lastHeartbeatAt: { $lt: staleBefore } }, { lastHeartbeatAt: null }],
    }),
    BackgroundJob.countDocuments({
      status: "queued",
      $or: [{ inngestEventId: null }, { inngestEventId: { $exists: false } }],
    }),
    BackgroundJob.countDocuments({ status: "dispatch_failed" }),
  ]);

  return { runningWithOldHeartbeat, queuedNotDispatched, dispatchFailed };
}
