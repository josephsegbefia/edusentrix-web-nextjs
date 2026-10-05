import "server-only";

import mongoose from "mongoose";
import { enqueueBackgroundJob, redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { isTerminalBackgroundJobStatus } from "@/lib/background/job-status";
import { BackgroundJob } from "@/models/BackgroundJob";
import type { HydratedDocument } from "mongoose";
import { ProvisioningJob, type IProvisioningJob } from "@/models/ProvisioningJob";

type ProvisioningDoc = HydratedDocument<IProvisioningJob>;

export function schoolProvisioningActionUrl() {
  return "/admin/settings/payment-setup";
}

export async function enqueueSchoolProvisioningBackgroundJob(input: {
  schoolId: mongoose.Types.ObjectId;
  domain: ProvisioningDoc;
  initiatedByUserId?: mongoose.Types.ObjectId | string | null;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const initiatedByUserId = input.initiatedByUserId
    ? new mongoose.Types.ObjectId(String(input.initiatedByUserId))
    : null;

  if (input.domain.backgroundJobId) {
    const existing = await BackgroundJob.findById(input.domain.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false, status: redispatched.job.status };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const payload =
    input.domain.payload && typeof input.domain.payload === "object" ? input.domain.payload : {};
  const revision = Number(payload.backgroundRevision ?? 1);

  const queued = await enqueueBackgroundJob({
    kind: "SCHOOL_PROVISIONING",
    schoolId: input.schoolId,
    initiatedByUserId,
    notificationTargetUserId: initiatedByUserId,
    subjectType: "ProvisioningJob",
    subjectId: input.domain._id,
    idempotencyKey: `provisioning:${String(input.schoolId)}:paystack_subaccount:${revision}`,
    input: { provisioningJobId: String(input.domain._id) },
  });

  input.domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await input.domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}
