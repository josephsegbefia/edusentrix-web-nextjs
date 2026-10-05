import mongoose from "mongoose";
import { requestBackgroundJobCancellation } from "@/lib/background/cancellation";
import { serializeSchemeImportJob } from "@/lib/schemes/scheme-import-serialize";
import { SchemeImportJob } from "@/models/SchemeImportJob";

export async function cancelSchemeImportJob(input: {
  schoolId: mongoose.Types.ObjectId;
  jobId: string;
  actorUserId: mongoose.Types.ObjectId;
  isSchoolAdmin?: boolean;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.jobId)) {
    return { ok: false as const, status: 400, error: "Invalid id" };
  }

  const job = await SchemeImportJob.findOne({
    _id: new mongoose.Types.ObjectId(input.jobId),
    schoolId: input.schoolId,
  });
  if (!job) {
    return { ok: false as const, status: 404, error: "Job not found" };
  }

  if (!["queued", "parsing", "parsed"].includes(job.status)) {
    return {
      ok: false as const,
      status: 409,
      error: "Only queued, parsing, or pending previews can be cancelled",
    };
  }

  if (job.backgroundJobId && (job.status === "queued" || job.status === "parsing")) {
    await requestBackgroundJobCancellation(job.backgroundJobId, {
      userId: input.actorUserId,
      schoolId: input.schoolId,
      isSchoolAdmin: input.isSchoolAdmin ?? true,
    });
  }

  if (job.status !== "parsing") {
    job.status = "cancelled";
    await job.save();
  }

  return {
    ok: true as const,
    job: serializeSchemeImportJob(job.toObject()),
  };
}
