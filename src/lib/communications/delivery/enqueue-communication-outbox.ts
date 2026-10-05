import "server-only";

import { Types } from "mongoose";
import { enqueueBackgroundJob, redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { isTerminalBackgroundJobStatus } from "@/lib/background/job-status";
import { BackgroundJob } from "@/models/BackgroundJob";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";

export async function enqueueCommunicationOutboxJobs(input: {
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  initiatedByUserId?: Types.ObjectId | null;
}): Promise<{ enqueued: number; reused: number }> {
  const jobs = await CommunicationOutboxJob.find({
    schoolId: input.schoolId,
    communicationId: input.communicationId,
    status: { $in: ["pending", "running", "failed"] },
  });

  let enqueued = 0;
  let reused = 0;
  for (const job of jobs) {
    const result = await enqueueOneCommunicationOutboxJob({
      schoolId: input.schoolId,
      outboxJob: job,
      initiatedByUserId: input.initiatedByUserId ?? null,
    });
    if (result.created) enqueued += 1;
    else reused += 1;
  }
  return { enqueued, reused };
}

export async function enqueueOneCommunicationOutboxJob(input: {
  schoolId: Types.ObjectId;
  outboxJob: { _id: Types.ObjectId; deliveryId: Types.ObjectId; backgroundJobId?: Types.ObjectId | null };
  initiatedByUserId?: Types.ObjectId | null;
}): Promise<{ jobId: string; created: boolean }> {
  if (input.outboxJob.backgroundJobId) {
    const existing = await BackgroundJob.findById(input.outboxJob.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false };
    }
  }

  const queued = await enqueueBackgroundJob({
    kind: "COMMUNICATION_OUTBOX",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    subjectType: "CommunicationOutboxJob",
    subjectId: input.outboxJob._id,
    notifyOnSuccess: false,
    notifyOnFailure: false,
    idempotencyKey: `comm-outbox:${String(input.outboxJob.deliveryId)}`,
    input: {
      communicationOutboxJobId: String(input.outboxJob._id),
      deliveryId: String(input.outboxJob.deliveryId),
    },
  });

  await CommunicationOutboxJob.updateOne(
    { _id: input.outboxJob._id },
    { $set: { backgroundJobId: new Types.ObjectId(queued.jobId) } }
  );
  return { jobId: queued.jobId, created: queued.created };
}
