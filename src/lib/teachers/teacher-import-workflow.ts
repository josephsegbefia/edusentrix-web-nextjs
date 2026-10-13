import "server-only";

import mongoose, { type HydratedDocument } from "mongoose";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";
import { ensureCanonicalUserForEmail, ensureMembershipForUser } from "@/lib/auth/canonical-user";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import {
  TeacherImportJob,
  type ITeacherImportClassResolution,
  type ITeacherImportJob,
  type ITeacherImportParsedRow,
  type TeacherImportInvitationMode,
} from "@/models/TeacherImportJob";

export const TEACHER_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

type TeacherImportDoc = HydratedDocument<ITeacherImportJob>;

function asObjectId(value: unknown) {
  const stringValue = String(value || "");
  return mongoose.isValidObjectId(stringValue) ? new mongoose.Types.ObjectId(stringValue) : null;
}

function sameId(left: unknown, right: unknown) {
  return String(left || "") === String(right || "");
}

function serializeRow(row: ITeacherImportParsedRow) {
  return {
    ...row,
    issues: row.issues || [],
    sourceValues: row.sourceValues || {},
  };
}

export function serializeTeacherImportJob(job: ITeacherImportJob) {
  return {
    id: String(job._id),
    status: job.status,
    fileName: job.fileName,
    mimeType: job.mimeType || null,
    selectedSheetName: job.selectedSheetName || null,
    availableSheets: job.availableSheets || [],
    sheetSelectionRequired: job.sheetSelectionRequired || false,
    columnMappings: job.columnMappings || [],
    parsedRows: (job.parsedRows || []).map(serializeRow),
    subjectResolutions: job.subjectResolutions || [],
    classResolutions: job.classResolutions || [],
    analysisSummary: job.analysisSummary || null,
    analysisWarnings: job.analysisWarnings || [],
    analysisErrors: job.analysisErrors || [],
    invitationMode: job.invitationMode,
    approvedAt: job.approvedAt || null,
    committedAt: job.committedAt || null,
    result: job.result || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function persistAndEnqueueTeacherImportAnalysis(input: {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileName: string;
  mimeType?: string | null;
  fileBytes: Buffer;
}) {
  if (!input.fileBytes.length) throw new Error("File is empty");
  if (input.fileBytes.length > TEACHER_IMPORT_MAX_BYTES) throw new Error("File is too large. Maximum size is 5MB.");

  const domain = await TeacherImportJob.create({
    schoolId: input.schoolId,
    createdByUserId: input.createdByUserId,
    status: "uploaded",
    fileName: input.fileName,
    mimeType: input.mimeType || null,
    fileBytes: input.fileBytes,
    invitationMode: "send_now",
  });
  const queued = await enqueueBackgroundJob({
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.createdByUserId,
    notificationTargetUserId: input.createdByUserId,
    subjectType: "TeacherImportJob",
    subjectId: domain._id,
    idempotencyKey: `teacher-import-analysis:${String(input.schoolId)}:${String(domain._id)}`,
    input: { teacherImportJobId: String(domain._id), teacherImportPhase: "analysis" },
  });
  domain.analysisBackgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await domain.save();
  return { job: domain, jobId: queued.jobId, teacherImportJobId: String(domain._id) };
}

export async function enqueueTeacherImportCommit(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherImportJobId: mongoose.Types.ObjectId;
  approvedByUserId: mongoose.Types.ObjectId;
  invitationMode: TeacherImportInvitationMode;
}) {
  const domain = await TeacherImportJob.findOne({ _id: input.teacherImportJobId, schoolId: input.schoolId });
  if (!domain) throw new Error("Teacher import not found");
  if (domain.status !== "review_ready") throw new Error("This teacher import is not ready for confirmation.");
  if ((domain.parsedRows || []).some((row) => row.resolutionStatus === "blocked" || row.resolutionStatus === "needs_review")) {
    throw new Error("Resolve all blocked and review items before confirming the teacher import.");
  }
  domain.invitationMode = input.invitationMode;
  domain.approvedByUserId = input.approvedByUserId;
  domain.approvedAt = new Date();
  domain.status = "committing";
  await domain.save();
  try {
    const queued = await enqueueBackgroundJob({
      kind: "BULK_IMPORT",
      schoolId: input.schoolId,
      initiatedByUserId: input.approvedByUserId,
      notificationTargetUserId: input.approvedByUserId,
      subjectType: "TeacherImportJob",
      subjectId: domain._id,
      idempotencyKey: `teacher-import-commit:${String(input.schoolId)}:${String(domain._id)}`,
      input: { teacherImportJobId: String(domain._id), teacherImportPhase: "commit" },
    });
    domain.commitBackgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
    await domain.save();
    return { job: domain, jobId: queued.jobId, teacherImportJobId: String(domain._id) };
  } catch (error) {
    domain.status = "review_ready";
    domain.approvedAt = null;
    domain.approvedByUserId = null;
    await domain.save();
    throw error;
  }
}

/** Recreates only a missing staged analysis dispatch; it never invokes legacy work. */
export async function recoverTeacherImportAnalysisDispatch(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherImportJobId: mongoose.Types.ObjectId;
}) {
  const domain = await TeacherImportJob.findOne({
    _id: input.teacherImportJobId,
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
    subjectType: "TeacherImportJob",
    subjectId: domain._id,
    idempotencyKey: `teacher-import-analysis-recovery:${String(input.schoolId)}:${String(domain._id)}`,
    input: { teacherImportJobId: String(domain._id), teacherImportPhase: "analysis" },
  });
  await TeacherImportJob.updateOne(
    {
      _id: domain._id,
      schoolId: input.schoolId,
      $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }],
    },
    { $set: { analysisBackgroundJobId: new mongoose.Types.ObjectId(queued.jobId) } }
  );
  return queued;
}

/** Recreates only a missing confirmed-commit dispatch; analysis is never promoted here. */
export async function recoverTeacherImportCommitDispatch(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherImportJobId: mongoose.Types.ObjectId;
}) {
  const domain = await TeacherImportJob.findOne({
    _id: input.teacherImportJobId,
    schoolId: input.schoolId,
    status: "committing",
    approvedAt: { $ne: null },
    $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
  });
  if (!domain) return null;
  const queued = await enqueueBackgroundJob({
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: domain.approvedByUserId || domain.createdByUserId,
    notificationTargetUserId: domain.approvedByUserId || domain.createdByUserId,
    subjectType: "TeacherImportJob",
    subjectId: domain._id,
    idempotencyKey: `teacher-import-commit-recovery:${String(input.schoolId)}:${String(domain._id)}`,
    input: { teacherImportJobId: String(domain._id), teacherImportPhase: "commit" },
  });
  await TeacherImportJob.updateOne(
    {
      _id: domain._id,
      schoolId: input.schoolId,
      $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
    },
    { $set: { commitBackgroundJobId: new mongoose.Types.ObjectId(queued.jobId) } }
  );
  return queued;
}

export async function executeTeacherImportAnalysis(tracked: TrackedJobContext) {
  const id = typeof tracked.job.input?.teacherImportJobId === "string" ? tracked.job.input.teacherImportJobId : "";
  const importId = asObjectId(id);
  if (!importId) throw new BackgroundJobError({ message: "teacherImportJobId is required", category: "PREREQUISITE_FAILED" });
  const current = await TeacherImportJob.findById(importId);
  if (!current) throw new BackgroundJobError({ message: "Teacher import not found", category: "PREREQUISITE_FAILED" });
  if (!sameId(current.schoolId, tracked.job.schoolId)) throw new BackgroundJobError({ message: "Teacher import tenant mismatch", category: "PREREQUISITE_FAILED" });
  if (["review_ready", "committing", "completed", "completed_with_errors", "cancelled"].includes(current.status)) {
    return { teacherImportJobId: id, status: current.status };
  }
  if (!current.fileBytes?.length) throw new BackgroundJobError({ message: "Uploaded teacher file is missing", category: "PERMANENT" });
  const claimed = await TeacherImportJob.findOneAndUpdate(
    { _id: importId, schoolId: current.schoolId, status: { $in: ["uploaded", "analyzing", "failed"] } },
    { $set: { status: "analyzing" } },
    { new: true }
  );
  if (!claimed) return { teacherImportJobId: id, status: (await TeacherImportJob.findById(importId))?.status || "unknown" };
  await tracked.updateProgress({ progressPercent: 10, progressStage: "reading_workbook", progressMessage: "Reading workbook" });
  try {
    await tracked.throwIfCancellationRequested();
    await tracked.updateProgress({ progressPercent: 35, progressStage: "resolving_school_data", progressMessage: "Checking classes and subject offerings" });
    const result = await analyzeTeacherImport({
      schoolId: claimed.schoolId,
      fileName: claimed.fileName,
      fileBytes: claimed.fileBytes as Buffer,
      selectedSheetName: claimed.selectedSheetName,
      columnMappings: claimed.columnMappings,
    });
    await tracked.updateProgress({ progressPercent: 90, progressStage: "saving_preview", progressMessage: "Preparing teacher review" });
    claimed.status = "review_ready";
    claimed.selectedSheetName = result.selectedSheetName;
    claimed.availableSheets = result.availableSheets;
    claimed.sheetSelectionRequired = result.sheetSelectionRequired;
    claimed.columnMappings = result.columnMappings;
    claimed.parsedRows = result.parsedRows;
    claimed.subjectResolutions = result.subjectResolutions;
    claimed.classResolutions = result.classResolutions;
    claimed.analysisSummary = result.analysisSummary;
    claimed.analysisWarnings = result.analysisWarnings;
    claimed.analysisErrors = result.analysisErrors;
    await claimed.save();
    return { teacherImportJobId: id, status: claimed.status, totalRows: claimed.parsedRows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Teacher import analysis failed";
    const permanent = /unsupported|empty|maximum|no data|malformed/i.test(message);
    claimed.status = "failed";
    claimed.analysisErrors = [{ code: "analysis_failed", message }];
    if (permanent) claimed.fileBytes = null;
    await claimed.save();
    throw new BackgroundJobError({ message, category: permanent ? "PERMANENT" : "RETRYABLE" });
  }
}

function classResolutionForRow(job: ITeacherImportJob, row: ITeacherImportParsedRow): ITeacherImportClassResolution | null {
  return (job.classResolutions || []).find((resolution) =>
    resolution.classGroupId && row.homeroomClassGroupId && sameId(resolution.classGroupId, row.homeroomClassGroupId)
  ) || (job.classResolutions || []).find((resolution) => resolution.affectedRows?.includes(row.sourceRowNumber)) || null;
}

async function markRow(job: TeacherImportDoc, index: number, update: Partial<ITeacherImportParsedRow>) {
  Object.assign(job.parsedRows[index], update);
  job.markModified("parsedRows");
  await job.save();
}

async function findExistingTeacher(input: { schoolId: mongoose.Types.ObjectId; email: string; employeeId?: string | null }) {
  const user = await User.findOne({ email: input.email }).select("_id").lean();
  if (user) {
    const teacher = await Teacher.findOne({ schoolId: input.schoolId, userId: user._id }).select("_id userId").lean();
    if (teacher) return teacher;
  }
  if (input.employeeId) {
    const teacher = await Teacher.findOne({ schoolId: input.schoolId, employeeId: input.employeeId }).select("_id userId").lean();
    if (teacher) return teacher;
  }
  return null;
}

async function assignHomeroom(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  decision: "replace" | "keep_existing" | "no_assign";
}) {
  if (input.decision === "no_assign" || input.decision === "keep_existing") return;
  const classGroup = await ClassGroup.findOne({ _id: input.classGroupId, schoolId: input.schoolId }).select("homeroomTeacherId").lean();
  if (!classGroup) throw new Error("Homeroom class group is no longer available in this school.");
  if (classGroup.homeroomTeacherId && !sameId(classGroup.homeroomTeacherId, input.teacherId)) {
    await Teacher.updateOne({ _id: classGroup.homeroomTeacherId, schoolId: input.schoolId }, { $unset: { homeroomClassGroupId: 1 } });
  }
  await ClassGroup.updateOne({ _id: input.classGroupId, schoolId: input.schoolId }, { $set: { homeroomTeacherId: input.teacherId } });
  await Teacher.updateOne({ _id: input.teacherId, schoolId: input.schoolId }, { $set: { homeroomClassGroupId: input.classGroupId } });
}

export async function executeTeacherImportCommit(tracked: TrackedJobContext) {
  const id = typeof tracked.job.input?.teacherImportJobId === "string" ? tracked.job.input.teacherImportJobId : "";
  const importId = asObjectId(id);
  if (!importId) throw new BackgroundJobError({ message: "teacherImportJobId is required", category: "PREREQUISITE_FAILED" });
  const job = await TeacherImportJob.findById(importId);
  if (!job) throw new BackgroundJobError({ message: "Teacher import not found", category: "PREREQUISITE_FAILED" });
  if (!sameId(job.schoolId, tracked.job.schoolId)) throw new BackgroundJobError({ message: "Teacher import tenant mismatch", category: "PREREQUISITE_FAILED" });
  if (["completed", "completed_with_errors", "cancelled"].includes(job.status)) return { teacherImportJobId: id, status: job.status, result: job.result };
  if (!job.approvedAt || !["committing", "review_ready"].includes(job.status)) throw new BackgroundJobError({ message: "Teacher import has not been approved", category: "PREREQUISITE_FAILED" });
  job.status = "committing";
  // The source is retained only through review/reanalysis, never during creation.
  job.fileBytes = null;
  await job.save();
  const school = await School.findById(job.schoolId).select("name").lean();
  let created = 0;
  let existing = 0;
  let failed = 0;
  let invitationsSent = 0;
  let invitationsQueued = 0;
  let invitationFailures = 0;
  for (let index = 0; index < job.parsedRows.length; index += 1) {
    await tracked.throwIfCancellationRequested();
    const row = job.parsedRows[index];
    if (["created", "existing", "skipped"].includes(row.rowState)) {
      if (row.rowState === "created") created += 1;
      else existing += 1;
      continue;
    }
    try {
      const duplicate = await findExistingTeacher({ schoolId: job.schoolId, email: row.email, employeeId: row.employeeId });
      if (duplicate) {
        await markRow(job, index, { rowState: "existing", teacherId: String(duplicate._id), commitError: "Already exists; skipped without overwriting." });
        existing += 1;
        continue;
      }
      const user = await ensureCanonicalUserForEmail({
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: normalizeGhanaPhoneForStorage(row.phone),
        role: "teacher",
        schoolId: job.schoolId,
        pendingOnboarding: false,
      });
      const userId = new mongoose.Types.ObjectId(String(user._id));
      const raceDuplicate = await Teacher.findOne({ schoolId: job.schoolId, userId }).select("_id").lean();
      if (raceDuplicate) {
        await markRow(job, index, { rowState: "existing", teacherId: String(raceDuplicate._id), commitError: "Already exists; skipped without overwriting." });
        existing += 1;
        continue;
      }
      await ensureMembershipForUser({ userId, schoolId: job.schoolId, role: "teacher", status: "active" });
      const classResolution = classResolutionForRow(job, row);
      const homeroomDecision = classResolution?.homeroomDecision || (row.homeroomClassGroupId ? "replace" : "no_assign");
      const teacher = await Teacher.create({
        schoolId: job.schoolId,
        userId,
        subjectIds: row.subjectIds.map((value) => new mongoose.Types.ObjectId(value)),
        subjectOfferingIds: row.subjectOfferingIds.map((value) => new mongoose.Types.ObjectId(value)),
        homeroomClassGroupId: row.homeroomClassGroupId && homeroomDecision === "replace" ? new mongoose.Types.ObjectId(row.homeroomClassGroupId) : null,
        status: row.status || "active",
        employeeId: row.employeeId || undefined,
        department: row.department || undefined,
      });
      if (row.homeroomClassGroupId && homeroomDecision === "replace") {
        await assignHomeroom({
          schoolId: job.schoolId,
          teacherId: teacher._id,
          classGroupId: new mongoose.Types.ObjectId(row.homeroomClassGroupId),
          decision: "replace",
        });
      }
      await logTeacherActivity({
        teacherId: String(teacher._id),
        schoolId: job.schoolId,
        type: "teacher.created",
        title: "Teacher created (reviewed import)",
        description: `Created from ${job.fileName}: ${row.firstName} ${row.lastName} (${row.email})`,
        metadata: { importId: String(job._id), sourceRowNumber: row.sourceRowNumber, subjectOfferingIds: row.subjectOfferingIds, homeroomClassGroupId: row.homeroomClassGroupId || null },
        createdBy: job.createdByUserId,
      });
      const next: Partial<ITeacherImportParsedRow> = { rowState: "created", teacherId: String(teacher._id), commitError: null, invitation: { status: "not_requested", warning: null, invitationId: null } };
      if (job.invitationMode === "send_now") {
        try {
          const invitation = await issueInvitation({
            email: row.email,
            role: "teacher",
            schoolId: job.schoolId,
            invitedBy: job.createdByUserId,
            recipientName: `${row.firstName} ${row.lastName}`,
            schoolName: school?.name || "your school",
            redirectNext: "/teacher",
            actorRole: "school_admin",
            relatedEntityType: "teacher_import",
            relatedEntityId: String(job._id),
            recipientUserId: String(userId),
            invitationMetadata: { firstName: row.firstName, lastName: row.lastName, subjectOfferingIds: row.subjectOfferingIds, importId: String(job._id) },
          });
          const invitationStatus = invitation.emailStatus === "sent" ? "sent" : invitation.emailStatus === "queued" ? "queued" : "failed";
          next.invitation = { status: invitationStatus, warning: invitation.warning || null, invitationId: invitation.invitationId };
          if (invitationStatus === "sent") invitationsSent += 1;
          else if (invitationStatus === "queued") invitationsQueued += 1;
          else invitationFailures += 1;
        } catch (error) {
          invitationFailures += 1;
          next.invitation = { status: "failed", warning: error instanceof Error ? error.message : "Invitation failed", invitationId: null };
        }
      }
      await markRow(job, index, next);
      created += 1;
    } catch (error) {
      failed += 1;
      await markRow(job, index, { rowState: "failed", commitError: error instanceof Error ? error.message.slice(0, 1000) : "Teacher creation failed" });
    }
    await tracked.updateProgress({ progressPercent: Math.round(((index + 1) / Math.max(job.parsedRows.length, 1)) * 100), progressStage: "creating_teachers", progressMessage: `Processed teacher ${index + 1} of ${job.parsedRows.length}` });
  }
  job.status = failed > 0 ? (created > 0 || existing > 0 ? "completed_with_errors" : "failed") : "completed";
  job.committedAt = new Date();
  job.result = { totalRows: job.parsedRows.length, created, existing, failed, invitationsSent, invitationsQueued, invitationFailures };
  await job.save();
  if (job.status === "failed") throw new BackgroundJobError({ message: "No teacher rows could be committed.", category: "PERMANENT" });
  return { teacherImportJobId: id, status: job.status, result: job.result };
}
