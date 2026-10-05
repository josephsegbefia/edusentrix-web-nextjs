import "server-only";

import { Types } from "mongoose";
import { BackgroundJob } from "@/models/BackgroundJob";
import { EmailMessage } from "@/models/EmailMessage";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { ACTIVE_BACKGROUND_JOB_STATUSES } from "@/lib/background/job-status";
import {
  emailDispatchIdempotencyKey,
  emailDispatchRetryIdempotencyKey,
  isSucceededEmailStatus,
} from "@/lib/email/email-dispatch-keys";

export type EnqueueEmailRetryResult = {
  enqueued: boolean;
  jobId?: string;
  reused: boolean;
  reason?: string;
};

function asObjectId(emailMessageId: string | Types.ObjectId): Types.ObjectId {
  return typeof emailMessageId === "string"
    ? new Types.ObjectId(emailMessageId)
    : emailMessageId;
}

/**
 * Queue the same EmailMessage for later dispatch without creating a second
 * message. Idempotent: at most one active EMAIL_DISPATCH job per message.
 */
export async function enqueueEmailMessageForRetry(
  emailMessageId: string | Types.ObjectId
): Promise<EnqueueEmailRetryResult> {
  const id = asObjectId(emailMessageId);
  const messageId = String(id);

  const message = await EmailMessage.findById(id);
  if (!message) {
    throw new Error("Email message not found");
  }

  if (isSucceededEmailStatus(message.status)) {
    return { enqueued: false, reused: false, reason: "already_sent" };
  }

  if (message.status === "dead_letter") {
    return { enqueued: false, reused: false, reason: "dead_letter" };
  }

  await EmailMessage.updateOne(
    { _id: id },
    {
      $set: { status: "queued", dispatchClaimedAt: null },
      $unset: { failureReason: 1 },
    }
  );

  const primaryKey = emailDispatchIdempotencyKey(messageId);
  const retryKey = emailDispatchRetryIdempotencyKey(messageId);
  const schoolId = message.schoolId ? String(message.schoolId) : null;

  const existing = await BackgroundJob.findOne({
    kind: "EMAIL_DISPATCH",
    idempotencyKey: { $in: [primaryKey, retryKey] },
  }).sort({ createdAt: 1 });

  if (existing && ACTIVE_BACKGROUND_JOB_STATUSES.includes(existing.status)) {
    const reused = await enqueueBackgroundJob({
      kind: "EMAIL_DISPATCH",
      schoolId,
      subjectType: "EmailMessage",
      subjectId: id,
      correlationId: messageId,
      input: { emailMessageId: messageId },
      idempotencyKey: existing.idempotencyKey || primaryKey,
    });
    return { enqueued: true, jobId: reused.jobId, reused: true };
  }

  const idempotencyKey =
    existing?.status === "failed" ? retryKey : primaryKey;

  const queued = await enqueueBackgroundJob({
    kind: "EMAIL_DISPATCH",
    schoolId,
    subjectType: "EmailMessage",
    subjectId: id,
    correlationId: messageId,
    input: { emailMessageId: messageId },
    idempotencyKey,
  });

  return {
    enqueued: true,
    jobId: queued.jobId,
    reused: !queued.created,
  };
}
