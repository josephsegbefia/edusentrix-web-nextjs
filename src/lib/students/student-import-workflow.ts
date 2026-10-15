import "server-only";
import mongoose, { type HydratedDocument } from "mongoose";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { analyzeStudentImport } from "@/lib/students/analyze-student-import";
import { createStudentForSchool, StudentCreationError } from "@/lib/students/create-student-service";
import { trackUsage } from "@/lib/billing/trackUsage";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { requireSchoolWriteAccess } from "@/lib/billing/require-school-write-access";
import { Student } from "@/models/Student";
import { School } from "@/models/School";
import { SchoolSettings } from "@/models/SchoolSettings";
import { buildDefaultStudentIdPattern, buildStudentIdPatternDraft, generateAdmissionNoFromPattern, missingFieldsForPattern } from "@/lib/students/student-id-pattern";
import { StudentImportJob, type IStudentImportJob, type IStudentImportParsedRow } from "@/models/StudentImportJob";
import { assertNoActiveImportDraft } from "@/lib/import-intelligence/active-draft";
import { buildImportReviewDto, importCompatibility, toImportPlainJson } from "@/lib/import-intelligence/serialize";
import { importVersionFields } from "@/lib/import-intelligence/versioning";

export const STUDENT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
type StudentImportDoc = HydratedDocument<IStudentImportJob>;
const objectId = (value: unknown) => mongoose.isValidObjectId(String(value || "")) ? new mongoose.Types.ObjectId(String(value)) : null;

export function serializeStudentImportJob(job: IStudentImportJob) {
  const plain = (toImportPlainJson(job) || {}) as Record<string, unknown>;
  return {
    id: String(plain._id || ""), status: String(plain.status || ""), fileName: String(plain.fileName || ""),
    mimeType: plain.mimeType || null, placementMode: plain.placementMode, fixedClassGroupId: plain.fixedClassGroupId ? String(plain.fixedClassGroupId) : null,
    fixedGradeId: plain.fixedGradeId ? String(plain.fixedGradeId) : null, fixedClassLabel: plain.fixedClassLabel || null, classConflictPolicy: plain.classConflictPolicy,
    selectedSheetName: plain.selectedSheetName || null, availableSheets: Array.isArray(plain.availableSheets) ? plain.availableSheets : [], sheetSelectionRequired: Boolean(plain.sheetSelectionRequired),
    dateFormat: plain.dateFormat, dateExamples: Array.isArray(plain.dateExamples) ? plain.dateExamples : [], columnMappings: Array.isArray(plain.columnMappings) ? plain.columnMappings : [],
    unusedColumns: Array.isArray(plain.unusedColumns) ? plain.unusedColumns : [], parsedRows: Array.isArray(plain.parsedRows) ? plain.parsedRows : [], gradeResolutions: Array.isArray(plain.gradeResolutions) ? plain.gradeResolutions : [],
    classResolutions: Array.isArray(plain.classResolutions) ? plain.classResolutions : [], analysisSummary: plain.analysisSummary || null, analysisWarnings: Array.isArray(plain.analysisWarnings) ? plain.analysisWarnings : [],
    analysisErrors: Array.isArray(plain.analysisErrors) ? plain.analysisErrors : [], leoAnalysis: plain.leoAnalysis || null, importSchemaVersion: plain.importSchemaVersion ?? null, analysisVersion: plain.analysisVersion ?? null,
    workbookInspection: plain.workbookInspection || null, columnInterpretations: Array.isArray(plain.columnInterpretations) ? plain.columnInterpretations : [], analysisIssues: Array.isArray(plain.analysisIssues) ? plain.analysisIssues : [],
    naturalLanguageResolutions: Array.isArray(plain.naturalLanguageResolutions) ? plain.naturalLanguageResolutions : [], compatibility: importCompatibility(job as unknown as Record<string, unknown>), review: buildImportReviewDto({ domain: "student", job: plain }),
    approvedAt: plain.approvedAt || null, committedAt: plain.committedAt || null, result: plain.result || null, createdAt: plain.createdAt || null, updatedAt: plain.updatedAt || null,
  };
}

export async function persistAndEnqueueStudentImportAnalysis(input: { schoolId: mongoose.Types.ObjectId; createdByUserId: mongoose.Types.ObjectId; fileName: string; mimeType?: string | null; fileBytes: Buffer; placementMode: "school_wide" | "class_scoped"; fixedGradeId?: mongoose.Types.ObjectId | null; fixedClassGroupId?: mongoose.Types.ObjectId | null; fixedClassLabel?: string | null }) {
  if (!input.fileBytes.length) throw new Error("File is empty.");
  if (input.fileBytes.length > STUDENT_IMPORT_MAX_BYTES) throw new Error("File is too large. Maximum size is 5MB.");
  await assertNoActiveImportDraft({ model: StudentImportJob, schoolId: input.schoolId, createdByUserId: input.createdByUserId });
  const job = await StudentImportJob.create({ ...input, ...importVersionFields(), status: "uploaded", classConflictPolicy: "review", dateFormat: "auto", fileBytes: input.fileBytes, analysisIssues: [], naturalLanguageResolutions: [] });
  const queued = await enqueueBackgroundJob({ kind: "BULK_IMPORT", schoolId: input.schoolId, initiatedByUserId: input.createdByUserId, notificationTargetUserId: input.createdByUserId, subjectType: "StudentImportJob", subjectId: job._id, idempotencyKey: `student-import-analysis:${input.schoolId}:${job._id}`, input: { studentImportJobId: String(job._id), studentImportPhase: "analysis" } });
  job.analysisBackgroundJobId = objectId(queued.jobId); await job.save();
  return { job, jobId: queued.jobId, studentImportJobId: String(job._id) };
}

export async function enqueueStudentImportCommit(input: { schoolId: mongoose.Types.ObjectId; studentImportJobId: mongoose.Types.ObjectId; approvedByUserId: mongoose.Types.ObjectId; classConflictPolicy?: "review" | "use_target" }) {
  const job = await StudentImportJob.findOne({ _id: input.studentImportJobId, schoolId: input.schoolId }); if (!job) throw new Error("Student import not found.");
  if (job.status !== "review_ready") throw new Error("This student import is not ready for confirmation.");
  if (input.classConflictPolicy) job.classConflictPolicy = input.classConflictPolicy;
  if ((job.parsedRows || []).some((row) => ["blocked", "needs_review"].includes(row.resolutionStatus))) throw new Error("Resolve all blocked and review items before confirming the student import.");
  job.status = "committing"; job.approvedByUserId = input.approvedByUserId; job.approvedAt = new Date(); await job.save();
  try { const queued = await enqueueBackgroundJob({ kind: "BULK_IMPORT", schoolId: input.schoolId, initiatedByUserId: input.approvedByUserId, notificationTargetUserId: input.approvedByUserId, subjectType: "StudentImportJob", subjectId: job._id, idempotencyKey: `student-import-commit:${input.schoolId}:${job._id}`, input: { studentImportJobId: String(job._id), studentImportPhase: "commit" } }); job.commitBackgroundJobId = objectId(queued.jobId); await job.save(); return { job, jobId: queued.jobId }; } catch (error) { job.status = "review_ready"; job.approvedAt = null; job.approvedByUserId = null; await job.save(); throw error; }
}

export async function executeStudentImportAnalysis(tracked: TrackedJobContext) {
  const idValue = typeof tracked.job.input?.studentImportJobId === "string" ? tracked.job.input.studentImportJobId : ""; const importId = objectId(idValue); if (!importId) throw new BackgroundJobError({ message: "studentImportJobId is required", category: "PREREQUISITE_FAILED" });
  const existing = await StudentImportJob.findById(importId); if (!existing) throw new BackgroundJobError({ message: "Student import not found", category: "PREREQUISITE_FAILED" }); if (String(existing.schoolId) !== String(tracked.job.schoolId)) throw new BackgroundJobError({ message: "Student import tenant mismatch", category: "PREREQUISITE_FAILED" });
  if (["review_ready", "committing", "completed", "completed_with_errors", "cancelled"].includes(existing.status)) return { studentImportJobId: idValue, status: existing.status };
  if (!existing.fileBytes?.length) throw new BackgroundJobError({ message: "Uploaded student file is missing", category: "PERMANENT" });
  const job = await StudentImportJob.findOneAndUpdate({ _id: importId, schoolId: existing.schoolId, status: { $in: ["uploaded", "analyzing", "failed"] } }, { $set: { status: "analyzing" } }, { new: true }); if (!job) return { studentImportJobId: idValue, status: (await StudentImportJob.findById(importId))?.status || "unknown" };
  try { await tracked.updateProgress({ progressPercent: 20, progressStage: "reading_workbook", progressMessage: "Reading student workbook" }); await tracked.throwIfCancellationRequested(); const result = await analyzeStudentImport({ schoolId: job.schoolId, fileName: job.fileName, fileBytes: job.fileBytes as Buffer, selectedSheetName: job.selectedSheetName, dateFormat: job.dateFormat, placementMode: job.placementMode, fixedGradeId: job.fixedGradeId, fixedClassGroupId: job.fixedClassGroupId, classConflictPolicy: job.classConflictPolicy }); job.status = "review_ready"; Object.assign(job, result); job.importSchemaVersion = importVersionFields().importSchemaVersion; job.analysisVersion = importVersionFields().analysisVersion; job.analysisIssues = buildImportReviewDto({ domain: "student", job: job.toObject({ flattenMaps: true }) as unknown as Record<string, unknown> }).currentIssues; if (job.leoAnalysis) job.leoAnalysis = { ...job.leoAnalysis, attempts: Number(job.leoAnalysis.attempts || 0) + 1 }; await job.save(); return { studentImportJobId: idValue, status: job.status, totalRows: job.parsedRows.length }; } catch (error) { const message = error instanceof Error ? error.message : "Student import analysis failed"; const permanent = /unsupported|empty|maximum|no data|malformed/i.test(message); job.status = "failed"; job.analysisErrors = [{ code: "analysis_failed", message }]; if (permanent) job.fileBytes = null; await job.save(); throw new BackgroundJobError({ message, category: permanent ? "PERMANENT" : "RETRYABLE" }); }
}

async function markRow(job: StudentImportDoc, index: number, update: Partial<IStudentImportParsedRow>) { Object.assign(job.parsedRows[index], update); job.markModified("parsedRows"); await job.save(); }

async function persistGeneratedAdmissionNo(job: StudentImportDoc, row: IStudentImportParsedRow) {
  if (row.admissionNo) return row.admissionNo;
  const [school, settings] = await Promise.all([
    School.findById(job.schoolId).select("name").lean(),
    SchoolSettings.findOne({ schoolId: job.schoolId }).select("studentIdGeneration.defaultPattern").lean(),
  ]);
  const raw = (settings as { studentIdGeneration?: { defaultPattern?: unknown } } | null)?.studentIdGeneration?.defaultPattern;
  const pattern = raw && typeof raw === "object" ? buildStudentIdPatternDraft(raw as Record<string, unknown>) : buildDefaultStudentIdPattern();
  const dateOfBirth = row.dateOfBirth ? new Date(`${row.dateOfBirth}T00:00:00.000Z`) : null;
  const enrolledAt = row.enrolledAt ? new Date(`${row.enrolledAt}T00:00:00.000Z`) : null;
  const missing = missingFieldsForPattern(pattern, { firstName: row.firstName, lastName: row.lastName, dateOfBirth, enrolledAt, gradeName: row.gradeName || "Grade", classGroupName: row.className || "Class" });
  if (missing.length) return null;
  const generated = await generateAdmissionNoFromPattern(pattern, { schoolId: job.schoolId, schoolName: school?.name || "School", firstName: row.firstName, lastName: row.lastName, dateOfBirth, enrolledAt, gradeName: row.gradeName || "Grade", classGroupName: row.className || "Class" });
  row.admissionNo = generated.admissionNo;
  job.markModified("parsedRows");
  await job.save();
  return generated.admissionNo;
}

export async function executeStudentImportCommit(tracked: TrackedJobContext) {
  const idValue = typeof tracked.job.input?.studentImportJobId === "string" ? tracked.job.input.studentImportJobId : ""; const importId = objectId(idValue); if (!importId) throw new BackgroundJobError({ message: "studentImportJobId is required", category: "PREREQUISITE_FAILED" }); const job = await StudentImportJob.findById(importId); if (!job) throw new BackgroundJobError({ message: "Student import not found", category: "PREREQUISITE_FAILED" }); if (String(job.schoolId) !== String(tracked.job.schoolId)) throw new BackgroundJobError({ message: "Student import tenant mismatch", category: "PREREQUISITE_FAILED" }); if (["completed", "cancelled"].includes(job.status)) return { studentImportJobId: idValue, status: job.status, result: job.result }; if (job.status === "completed_with_errors" && !job.parsedRows.some((row) => row.rowState === "failed" || (row.rowState === "created" && row.usageRecorded === false))) return { studentImportJobId: idValue, status: job.status, result: job.result };
  if (!job.approvedAt || !["committing", "review_ready"].includes(job.status)) throw new BackgroundJobError({ message: "Student import has not been approved", category: "PREREQUISITE_FAILED" }); job.status = "committing"; job.fileBytes = null; await job.save();
  await requireSchoolWriteAccess({ schoolId: job.schoolId, action: "students.create" });
  let created = 0, existing = 0, failed = 0, usageFailures = 0;
  for (let index = 0; index < job.parsedRows.length; index += 1) { await tracked.throwIfCancellationRequested(); const row = job.parsedRows[index]; if (row.rowState === "created") { created += 1; if (!row.usageRecorded && row.studentId) { try { await trackUsage({ schoolId: job.schoolId, provider: "internal", metricKey: "student_records_created", quantity: 1, unitLabel: "students", allocationMethod: "manual", sourceType: "manual", actorId: job.createdByUserId, entityType: "Student", entityId: new mongoose.Types.ObjectId(row.studentId), notes: "Student created through staged import." }); await markRow(job, index, { usageRecorded: true }); } catch { usageFailures += 1; } } continue; } if (["existing", "skipped"].includes(row.rowState)) { existing += 1; continue; } if (row.resolutionStatus !== "resolved") { failed += 1; continue; }
    try {
      await persistGeneratedAdmissionNo(job, row);
      const duplicate = row.admissionNo ? await Student.findOne({ schoolId: job.schoolId, admissionNo: row.admissionNo }).select("_id").lean() : null; if (duplicate) { await markRow(job, index, { rowState: "existing", resolutionStatus: "resolved", studentId: String(duplicate._id), commitError: "Already exists; skipped without overwriting." }); existing += 1; continue; }
      const student = await createStudentForSchool({ schoolId: job.schoolId, firstName: row.firstName, middleName: row.middleName, lastName: row.lastName, gradeId: row.gradeId || "", classGroupId: row.classGroupId || "", admissionNo: row.admissionNo, sex: row.sex, dateOfBirth: row.dateOfBirth ? new Date(`${row.dateOfBirth}T00:00:00.000Z`) : null, enrolledAt: row.enrolledAt ? new Date(`${row.enrolledAt}T00:00:00.000Z`) : null, status: row.status, gesIndexNumber: row.gesIndexNumber, gesSchoolCode: row.gesSchoolCode, actorId: job.createdByUserId, trackUsage: false, enforceLimit: true, enforceCapacity: true });
      await markRow(job, index, { rowState: "created", resolutionStatus: "resolved", studentId: String(student._id), admissionNo: student.admissionNo || row.admissionNo, usageRecorded: false }); created += 1;
      try { await trackUsage({ schoolId: job.schoolId, provider: "internal", metricKey: "student_records_created", quantity: 1, unitLabel: "students", allocationMethod: "manual", sourceType: "manual", actorId: job.createdByUserId, entityType: "Student", entityId: student._id, notes: "Student created through staged import." }); await markRow(job, index, { usageRecorded: true }); } catch { usageFailures += 1; }
    } catch (error) { failed += 1; const message = error instanceof Error ? error.message : "Student creation failed"; await markRow(job, index, { rowState: "failed", commitError: message }); }
    await tracked.updateProgress({ progressPercent: Math.min(99, Math.round(((index + 1) / Math.max(1, job.parsedRows.length)) * 100)), progressStage: "committing", progressMessage: `Creating student ${index + 1} of ${job.parsedRows.length}` });
  }
  job.status = failed || usageFailures ? (created || existing ? "completed_with_errors" : "failed") : "completed"; job.committedAt = new Date(); job.result = { totalRows: job.parsedRows.length, created, existing, failed, usageFailures }; await job.save(); if (job.status === "failed") throw new BackgroundJobError({ message: "Student import did not create any students.", category: "PERMANENT" }); return { studentImportJobId: idValue, status: job.status, result: job.result };
}
