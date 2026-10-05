import { BackgroundJob } from "@/models/BackgroundJob";
import {
  getBackgroundJobKindPolicy,
  isBackgroundJobKind,
  type BackgroundWorkloadClass,
} from "./job-kinds";

export const DEFAULT_STALE_HEARTBEAT_MS = 15 * 60 * 1000;

export const STALE_HEARTBEAT_MS_BY_WORKLOAD: Record<BackgroundWorkloadClass, number> = {
  EMAIL: 10 * 60 * 1000,
  SYSTEM: 15 * 60 * 1000,
  PROVISIONING: 20 * 60 * 1000,
  STORAGE: 20 * 60 * 1000,
  IMPORT: 30 * 60 * 1000,
  AI: 45 * 60 * 1000,
};

export function staleHeartbeatMsForKind(kind: string): number {
  if (!isBackgroundJobKind(kind)) return DEFAULT_STALE_HEARTBEAT_MS;
  return STALE_HEARTBEAT_MS_BY_WORKLOAD[getBackgroundJobKindPolicy(kind).workloadClass];
}

export function staleHeartbeatThresholdMs(): number {
  return DEFAULT_STALE_HEARTBEAT_MS;
}

export type StaleBackgroundJobQuery = {
  runningWithOldHeartbeat: number;
  queuedNotDispatched: number;
  dispatchFailed: number;
  exhaustedRecovery: number;
};

export async function queryStaleBackgroundJobs(): Promise<StaleBackgroundJobQuery> {
  const now = Date.now();
  const [running, queuedNotDispatched, dispatchFailed, exhaustedRecovery] = await Promise.all([
    BackgroundJob.find({
      status: { $in: ["running", "waiting"] },
    })
      .select("kind lastHeartbeatAt startedAt")
      .lean<Array<{ kind: string; lastHeartbeatAt?: Date | null; startedAt?: Date | null }>>(),
    BackgroundJob.countDocuments({
      status: "queued",
      $or: [{ inngestEventId: null }, { inngestEventId: { $exists: false } }],
    }),
    BackgroundJob.countDocuments({ status: "dispatch_failed" }),
    BackgroundJob.countDocuments({
      status: "dispatch_failed",
      recoveryAttempts: { $gte: 5 },
    }),
  ]);

  const runningWithOldHeartbeat = running.filter((job) => {
    const heartbeat = job.lastHeartbeatAt ?? job.startedAt;
    if (!heartbeat) return true;
    return now - new Date(heartbeat).getTime() > staleHeartbeatMsForKind(job.kind);
  }).length;

  return {
    runningWithOldHeartbeat,
    queuedNotDispatched,
    dispatchFailed,
    exhaustedRecovery,
  };
}
