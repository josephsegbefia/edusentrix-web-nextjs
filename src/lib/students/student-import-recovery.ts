import "server-only";

import mongoose from "mongoose";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { StudentImportJob } from "@/models/StudentImportJob";

/** Recreate an absent analysis dispatch without changing a review or commit state. */
export async function recoverStudentImportAnalysisDispatch(input: {
  schoolId: mongoose.Types.ObjectId;
  studentImportJobId: mongoose.Types.ObjectId;
}) {
  const domain = await StudentImportJob.findOne({
    _id: input.studentImportJobId,
    schoolId: input.schoolId,
    status: { $in: ["uploaded", "analyzing"] },
    $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }],
  });
  if (!domain?.fileBytes?.length) return null;
  const queued = await enqueueBackgroundJob({
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: domain.createdByUserId,
    notificationTargetUserId: domain.createdByUserId,
    subjectType: "StudentImportJob",
    subjectId: domain._id,
    idempotencyKey: `student-import-analysis-recovery:${String(input.schoolId)}:${String(domain._id)}`,
    input: { studentImportJobId: String(domain._id), studentImportPhase: "analysis" },
  });
  await StudentImportJob.updateOne(
    {
      _id: domain._id,
      schoolId: input.schoolId,
      $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }],
    },
    { $set: { analysisBackgroundJobId: new mongoose.Types.ObjectId(queued.jobId) } }
  );
  return queued;
}

/** Recreate an absent commit dispatch only after explicit approval. */
export async function recoverStudentImportCommitDispatch(input: {
  schoolId: mongoose.Types.ObjectId;
  studentImportJobId: mongoose.Types.ObjectId;
}) {
  const domain = await StudentImportJob.findOne({
    _id: input.studentImportJobId,
    schoolId: input.schoolId,
    status: "committing",
    approvedAt: { $ne: null },
    $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
  });
  if (!domain) return null;
  const actor = domain.approvedByUserId || domain.createdByUserId;
  const queued = await enqueueBackgroundJob({
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: actor,
    notificationTargetUserId: actor,
    subjectType: "StudentImportJob",
    subjectId: domain._id,
    idempotencyKey: `student-import-commit-recovery:${String(input.schoolId)}:${String(domain._id)}`,
    input: { studentImportJobId: String(domain._id), studentImportPhase: "commit" },
  });
  await StudentImportJob.updateOne(
    {
      _id: domain._id,
      schoolId: input.schoolId,
      $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
    },
    { $set: { commitBackgroundJobId: new mongoose.Types.ObjectId(queued.jobId) } }
  );
  return queued;
}
