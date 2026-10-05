import "server-only";

import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { EmailMessage } from "@/models/EmailMessage";

export type EmailDispatchHealth = {
  pendingJobs: number;
  failedJobs: number;
  deadLetterJobs: number;
  runningJobs: number;
  queuedMessages: number;
  oldestPendingAgeMs: number | null;
};

export async function getEmailDispatchHealth(): Promise<EmailDispatchHealth> {
  const [pendingJobs, failedJobs, deadLetterJobs, runningJobs, queuedMessages, oldestPending] =
    await Promise.all([
      EmailDispatchJob.countDocuments({ status: "pending" }),
      EmailDispatchJob.countDocuments({ status: "failed" }),
      EmailDispatchJob.countDocuments({ status: "dead_letter" }),
      EmailDispatchJob.countDocuments({ status: "running" }),
      EmailMessage.countDocuments({ status: "queued" }),
      EmailDispatchJob.findOne({ status: "pending" })
        .sort({ createdAt: 1 })
        .select("createdAt")
        .lean<{ createdAt?: Date } | null>(),
    ]);

  return {
    pendingJobs,
    failedJobs,
    deadLetterJobs,
    runningJobs,
    queuedMessages,
    oldestPendingAgeMs: oldestPending?.createdAt
      ? Date.now() - new Date(oldestPending.createdAt).getTime()
      : null,
  };
}
