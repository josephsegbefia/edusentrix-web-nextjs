import { BackgroundJob } from "@/models/BackgroundJob";
import { getBackgroundJobKindPolicy, type BackgroundJobKind } from "./job-kinds";
import { isInngestConfigured } from "./inngest";
import { queryStaleBackgroundJobs } from "./stale-jobs";

export type BackgroundWorkHealth = {
  queuedJobs: number;
  dispatchFailedJobs: number;
  runningJobs: number;
  waitingJobs: number;
  cancelRequestedJobs: number;
  failedJobs: number;
  succeededJobs: number;
  cancelledJobs: number;
  oldestQueuedAgeMs: number | null;
  oldestRunningHeartbeatAgeMs: number | null;
  jobsByKind: Record<string, number>;
  jobsByWorkloadClass: Record<string, number>;
  stale: {
    runningWithOldHeartbeat: number;
    queuedNotDispatched: number;
    dispatchFailed: number;
  };
  inngestConfigured: boolean;
};

export async function getBackgroundWorkHealth(): Promise<BackgroundWorkHealth> {
  const [
    queuedJobs,
    dispatchFailedJobs,
    runningJobs,
    waitingJobs,
    cancelRequestedJobs,
    failedJobs,
    succeededJobs,
    cancelledJobs,
    oldestQueued,
    oldestRunning,
    kindRows,
    stale,
  ] = await Promise.all([
    BackgroundJob.countDocuments({ status: "queued" }),
    BackgroundJob.countDocuments({ status: "dispatch_failed" }),
    BackgroundJob.countDocuments({ status: "running" }),
    BackgroundJob.countDocuments({ status: "waiting" }),
    BackgroundJob.countDocuments({ status: "cancel_requested" }),
    BackgroundJob.countDocuments({ status: "failed" }),
    BackgroundJob.countDocuments({ status: "succeeded" }),
    BackgroundJob.countDocuments({ status: "cancelled" }),
    BackgroundJob.findOne({ status: "queued" })
      .sort({ queuedAt: 1 })
      .select("queuedAt")
      .lean<{ queuedAt?: Date } | null>(),
    BackgroundJob.findOne({ status: "running" })
      .sort({ lastHeartbeatAt: 1 })
      .select("lastHeartbeatAt startedAt")
      .lean<{ lastHeartbeatAt?: Date | null; startedAt?: Date | null } | null>(),
    BackgroundJob.aggregate<{ _id: BackgroundJobKind; count: number }>([
      { $group: { _id: "$kind", count: { $sum: 1 } } },
    ]),
    queryStaleBackgroundJobs(),
  ]);

  const jobsByKind: Record<string, number> = {};
  const jobsByWorkloadClass: Record<string, number> = {};
  for (const row of kindRows) {
    jobsByKind[row._id] = row.count;
    const workload = getBackgroundJobKindPolicy(row._id).workloadClass;
    jobsByWorkloadClass[workload] = (jobsByWorkloadClass[workload] ?? 0) + row.count;
  }

  const heartbeatAt = oldestRunning?.lastHeartbeatAt ?? oldestRunning?.startedAt ?? null;

  return {
    queuedJobs,
    dispatchFailedJobs,
    runningJobs,
    waitingJobs,
    cancelRequestedJobs,
    failedJobs,
    succeededJobs,
    cancelledJobs,
    oldestQueuedAgeMs: oldestQueued?.queuedAt
      ? Date.now() - new Date(oldestQueued.queuedAt).getTime()
      : null,
    oldestRunningHeartbeatAgeMs: heartbeatAt
      ? Date.now() - new Date(heartbeatAt).getTime()
      : null,
    jobsByKind,
    jobsByWorkloadClass,
    stale,
    inngestConfigured: isInngestConfigured(),
  };
}
