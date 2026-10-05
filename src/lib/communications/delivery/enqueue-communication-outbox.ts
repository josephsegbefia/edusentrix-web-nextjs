import "server-only";

import { Types } from "mongoose";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";
import { enqueueOneCommunicationOutboxJob } from "@/lib/background/domain-enqueue";

export { enqueueOneCommunicationOutboxJob } from "@/lib/background/domain-enqueue";

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
