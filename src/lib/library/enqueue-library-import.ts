import "server-only";

import { Types } from "mongoose";
import { enqueueBackgroundJob, redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { isTerminalBackgroundJobStatus } from "@/lib/background/job-status";
import { BackgroundJob } from "@/models/BackgroundJob";
import { LibraryImportJob } from "@/models/LibraryImportJob";

export function libraryImportActionUrl() {
  return "/admin/library/imports";
}

export async function enqueueLibraryImportBackgroundJob(input: {
  schoolId: Types.ObjectId;
  libraryImportJobId: Types.ObjectId;
  initiatedByUserId: Types.ObjectId;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const domain = await LibraryImportJob.findOne({
    _id: input.libraryImportJobId,
    schoolId: input.schoolId,
  });
  if (!domain) {
    throw new Error("Library import job not found");
  }
  if (domain.backgroundJobId) {
    const existing = await BackgroundJob.findById(domain.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false, status: redispatched.job.status };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const queued = await enqueueBackgroundJob({
    kind: "LIBRARY_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    notificationTargetUserId: input.initiatedByUserId,
    subjectType: "LibraryImportJob",
    subjectId: input.libraryImportJobId,
    idempotencyKey: `library-import:${String(input.schoolId)}:${String(input.libraryImportJobId)}`,
    input: { libraryImportJobId: String(input.libraryImportJobId) },
  });

  domain.backgroundJobId = new Types.ObjectId(queued.jobId);
  await domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}
