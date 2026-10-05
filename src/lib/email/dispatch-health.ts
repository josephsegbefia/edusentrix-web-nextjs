import "server-only";

import { BackgroundJob } from "@/models/BackgroundJob";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { EmailMessage } from "@/models/EmailMessage";
import { isInngestConfigured } from "@/lib/background/inngest";

export type EmailDispatchHealth = {
  backgroundJobs: {
    queued: number;
    running: number;
    dispatchFailed: number;
    failed: number;
    oldestQueuedAgeMs: number | null;
  };
  emailMessages: {
    queued: number;
    failed: number;
  };
  legacyDispatchJobs: {
    pending: number;
    running: number;
    failed: number;
    deadLetter: number;
  };
  inngestConfigured: boolean;
};

export async function getEmailDispatchHealth(): Promise<EmailDispatchHealth> {
  const [
    queuedJobs,
    runningJobs,
    dispatchFailedJobs,
    failedJobs,
    oldestQueued,
    queuedMessages,
    failedMessages,
    legacyPending,
    legacyRunning,
    legacyFailed,
    legacyDeadLetter,
  ] = await Promise.all([
    BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH", status: "queued" }),
    BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH", status: "running" }),
    BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH", status: "dispatch_failed" }),
    BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH", status: "failed" }),
    BackgroundJob.findOne({ kind: "EMAIL_DISPATCH", status: "queued" })
      .sort({ queuedAt: 1 })
      .select("queuedAt")
      .lean<{ queuedAt?: Date } | null>(),
    EmailMessage.countDocuments({ status: "queued" }),
    EmailMessage.countDocuments({ status: "failed" }),
    EmailDispatchJob.countDocuments({ status: "pending" }),
    EmailDispatchJob.countDocuments({ status: "running" }),
    EmailDispatchJob.countDocuments({ status: "failed" }),
    EmailDispatchJob.countDocuments({ status: "dead_letter" }),
  ]);

  return {
    backgroundJobs: {
      queued: queuedJobs,
      running: runningJobs,
      dispatchFailed: dispatchFailedJobs,
      failed: failedJobs,
      oldestQueuedAgeMs: oldestQueued?.queuedAt
        ? Date.now() - new Date(oldestQueued.queuedAt).getTime()
        : null,
    },
    emailMessages: {
      queued: queuedMessages,
      failed: failedMessages,
    },
    legacyDispatchJobs: {
      pending: legacyPending,
      running: legacyRunning,
      failed: legacyFailed,
      deadLetter: legacyDeadLetter,
    },
    inngestConfigured: isInngestConfigured(),
  };
}
