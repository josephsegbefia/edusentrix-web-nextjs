import "server-only";

import { Types } from "mongoose";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { EmailMessage } from "@/models/EmailMessage";
import { lookupTemplateRegistry } from "./registry";

const ACTIVE_JOB_STATUSES = ["pending", "running", "failed"] as const;

export type EnqueueEmailRetryResult = {
  enqueued: boolean;
  jobId?: string;
  reused: boolean;
  reason?: string;
};

/**
 * Queue the same EmailMessage for later dispatch without creating a second
 * message. Idempotent: at most one active job per message.
 */
export async function enqueueEmailMessageForRetry(
  emailMessageId: string | Types.ObjectId
): Promise<EnqueueEmailRetryResult> {
  const id =
    typeof emailMessageId === "string"
      ? new Types.ObjectId(emailMessageId)
      : emailMessageId;

  const message = await EmailMessage.findById(id);
  if (!message) {
    throw new Error("Email message not found");
  }

  if (message.status === "sent" || message.status === "delivered") {
    return { enqueued: false, reused: false, reason: "already_sent" };
  }

  await EmailMessage.updateOne(
    { _id: id },
    {
      $set: { status: "queued" },
      $unset: { failureReason: 1 },
    }
  );

  const existing = await EmailDispatchJob.findOne({
    emailMessageId: id,
    status: { $in: [...ACTIVE_JOB_STATUSES] },
  }).sort({ createdAt: 1 });

  if (existing) {
    if (existing.status === "failed") {
      await EmailDispatchJob.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: "pending",
            nextRunAt: new Date(),
            lastError: null,
          },
        }
      );
    }
    return { enqueued: true, jobId: String(existing._id), reused: true };
  }

  const registry = message.templateKey
    ? lookupTemplateRegistry(message.templateKey)
    : null;

  const job = await EmailDispatchJob.create({
    kind: "outbound_single",
    emailMessageId: id,
    schoolId: message.schoolId || null,
    senderFamily: registry?.senderFamily || "hello",
    trafficClass: message.trafficClass || "transactional",
    priority: message.priority || "high",
    status: "pending",
    maxAttempts: 10,
    nextRunAt: new Date(),
  });

  return { enqueued: true, jobId: String(job._id), reused: false };
}
