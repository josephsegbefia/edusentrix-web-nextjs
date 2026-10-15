import "server-only";

import mongoose, { type HydratedDocument } from "mongoose";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import { analyzeTeacherIdentityImport } from "@/lib/teachers/analyze-teacher-identity-import";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";
import { ensureCanonicalUserForEmail, ensureMembershipForUser } from "@/lib/auth/canonical-user";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { assertNoActiveImportDraft } from "@/lib/import-intelligence/active-draft";
import { buildImportReviewDto, importCompatibility } from "@/lib/import-intelligence/serialize";
import { importVersionFields } from "@/lib/import-intelligence/versioning";
import {
  TeacherImportJob,
  type ITeacherImportClassResolution,
  type ITeacherImportJob,
  type ITeacherImportParsedRow,
  type TeacherImportInvitationMode,
  type TeacherImportWorkflow,
} from "@/models/TeacherImportJob";
import { getTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";

export const TEACHER_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

type TeacherImportDoc = HydratedDocument<ITeacherImportJob>;

type TeacherImportUploadWriteStage =
  | "teacher_import_create"
  | "background_job_enqueue"
  | "teacher_import_link";

type MongoErrorShape = {
  name?: unknown;
  code?: unknown;
  codeName?: unknown;
  keyPattern?: unknown;
  errorLabels?: unknown;
};

export type TeacherImportUploadFailureDetails = {
  writeStage: TeacherImportUploadWriteStage | "unknown";
  errorType: string;
  mongoCode: number | string | null;
  mongoCodeName: string | null;
  mongoKeyFields: string[];
  mongoErrorLabels: string[];
  teacherImportJobId: string | null;
  backgroundJobId: string | null;
};

class TeacherImportUploadWriteError extends Error {
  readonly details: TeacherImportUploadFailureDetails;

  constructor(
    stage: TeacherImportUploadWriteStage,
    error: unknown,
    ids: { teacherImportJobId?: unknown; backgroundJobId?: unknown } = {}
  ) {
    super("Teacher import upload persistence failed");
    this.name = "TeacherImportUploadWriteError";
    this.details = safeTeacherImportUploadFailureDetails(error, stage, ids);
  }
}

function safeTeacherImportUploadFailureDetails(
  error: unknown,
  writeStage: TeacherImportUploadFailureDetails["writeStage"] = "unknown",
  ids: { teacherImportJobId?: unknown; backgroundJobId?: unknown } = {}
): TeacherImportUploadFailureDetails {
  const candidate = error && typeof error === "object" ? error as MongoErrorShape : {};
  const keyPattern = candidate.keyPattern && typeof candidate.keyPattern === "object"
    ? Object.keys(candidate.keyPattern as Record<string, unknown>).slice(0, 20)
    : [];
  return {
    writeStage,
    errorType: typeof candidate.name === "string" ? candidate.name : "UnknownError",
    mongoCode: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : null,
    mongoCodeName: typeof candidate.codeName === "string" ? candidate.codeName : null,
    mongoKeyFields: keyPattern,
    mongoErrorLabels: Array.isArray(candidate.errorLabels)
      ? candidate.errorLabels.filter((label): label is string => typeof label === "string").slice(0, 10)
      : [],
    teacherImportJobId: ids.teacherImportJobId ? String(ids.teacherImportJobId) : null,
    backgroundJobId: ids.backgroundJobId ? String(ids.backgroundJobId) : null,
  };
}

export function getTeacherImportUploadFailureDetails(
  error: unknown
): TeacherImportUploadFailureDetails {
  return error instanceof TeacherImportUploadWriteError
    ? error.details
    : safeTeacherImportUploadFailureDetails(error);
}

function asObjectId(value: unknown) {
  const stringValue = String(value || "");
  return mongoose.isValidObjectId(stringValue) ? new mongoose.Types.ObjectId(stringValue) : null;
}

function sameId(left: unknown, right: unknown) {
  return String(left || "") === String(right || "");
}

type PlainRecord = Record<string, unknown>;

function asPlainRecord(value: unknown): PlainRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as PlainRecord
    : {};
}

function toPlainJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();

  const candidate = value as {
    toObject?: (options?: { flattenMaps?: boolean }) => unknown;
  };
  if (typeof candidate.toObject === "function") {
    return toPlainJson(candidate.toObject({ flattenMaps: true }), seen);
  }
  if (seen.has(value)) return undefined;
  seen.add(value);

  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, item]) => [String(key), toPlainJson(item, seen)])
    );
  }
  if (Array.isArray(value)) return value.map((item) => toPlainJson(item, seen));

  const record: PlainRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "_doc" || key === "$__" || key === "$isNew" || key.startsWith("$")) continue;
    const plainItem = toPlainJson(item, seen);
    if (plainItem !== undefined) record[key] = plainItem;
  }
  return record;
}

function plainString(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function sourceValues(value: unknown): Record<string, string> {
  const plain = toPlainJson(value);
  if (!plain || typeof plain !== "object" || Array.isArray(plain)) return {};
  return Object.fromEntries(
    Object.entries(plain).map(([key, item]) => [key, plainString(item)])
  );
}

function serializeIssue(value: unknown) {
  const issue = asPlainRecord(toPlainJson(value));
  return {
    code: plainString(issue.code),
    message: plainString(issue.message),
    field: nullableString(issue.field),
    value: nullableString(issue.value),
    affectedRows: Array.isArray(issue.affectedRows)
      ? issue.affectedRows.filter((row): row is number => typeof row === "number")
      : [],
  };
}

function serializeRow(value: unknown) {
  const row = asPlainRecord(toPlainJson(value));
  const hasAnalysisState = typeof row.resolutionStatus === "string" && typeof row.rowState === "string";
  const issues = Array.isArray(row.issues) ? row.issues.map(serializeIssue) : [];
  if (!hasAnalysisState) {
    issues.push({
      code: "legacy_import_needs_reanalysis",
      message: "This import was created by an older import version and needs to be re-analysed/re-uploaded.",
      field: null,
      value: null,
      affectedRows: [],
    });
  }

  return {
    sourceRowNumber: typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : 0,
    rowRef: plainString(row.rowRef, `T${String(typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : 0).padStart(3, "0")}`),
    sourceValues: sourceValues(row.sourceValues),
    firstName: plainString(row.firstName),
    middleNames: stringArray(row.middleNames),
    lastName: plainString(row.lastName),
    fullName: nullableString(row.fullName),
    sourceFullName: nullableString(row.sourceFullName || row.fullName),
    email: plainString(row.email),
    phone: nullableString(row.phone),
    employeeId: nullableString(row.employeeId),
    department: nullableString(row.department),
    status: nullableString(row.status),
    subjects: stringArray(row.subjects),
    gradeScopes: stringArray(row.gradeScopes),
    gradeScopeIds: stringArray(row.gradeScopeIds),
    classScopes: stringArray(row.classScopes),
    classScopeIds: stringArray(row.classScopeIds),
    explicitAssignments: Array.isArray(row.explicitAssignments) ? toPlainJson(row.explicitAssignments) : [],
    subjectOfferingIds: stringArray(row.subjectOfferingIds),
    subjectIds: stringArray(row.subjectIds),
    homeroomClass: nullableString(row.homeroomClass),
    homeroomGrade: nullableString(row.homeroomGrade),
    homeroomClassGroupId: nullableString(row.homeroomClassGroupId),
    resolutionStatus: hasAnalysisState ? plainString(row.resolutionStatus) : "needs_review",
    rowState: hasAnalysisState ? plainString(row.rowState) : "pending",
    issues,
    commitError: nullableString(row.commitError),
    teacherId: nullableString(row.teacherId),
    setupStatus: plainString(row.setupStatus, "pending"),
    setupError: nullableString(row.setupError),
    photoUrl: nullableString(row.photoUrl),
    invitation: row.invitation && typeof row.invitation === "object"
      ? {
          status: plainString(asPlainRecord(row.invitation).status, "not_requested"),
          warning: nullableString(asPlainRecord(row.invitation).warning),
          invitationId: nullableString(asPlainRecord(row.invitation).invitationId),
        }
      : null,
    provenance: Array.isArray(row.provenance) ? toPlainJson(row.provenance) : [],
  };
}

function serializeColumnMapping(value: unknown) {
  const mapping = asPlainRecord(toPlainJson(value));
  return {
    sourceHeader: plainString(mapping.sourceHeader),
    canonicalField: nullableString(mapping.canonicalField),
    source: plainString(mapping.source),
    confidence: typeof mapping.confidence === "number" ? mapping.confidence : 0,
    status: plainString(mapping.status, "needs_review"),
  };
}

function serializeSubjectResolution(value: unknown) {
  const resolution = asPlainRecord(toPlainJson(value));
  const sourceValue = plainString(resolution.sourceValue);
  return {
    resolutionKey: plainString(resolution.resolutionKey, sourceValue ? `legacy:${sourceValue}` : ""),
    sourceValue,
    subjectFamily: nullableString(resolution.subjectFamily),
    subjectOfferingIds: stringArray(resolution.subjectOfferingIds),
    resolvedNames: stringArray(resolution.resolvedNames),
    candidateOptions: Array.isArray(resolution.candidateOptions)
      ? resolution.candidateOptions.map((option) => {
          const item = asPlainRecord(toPlainJson(option));
          return {
            id: plainString(item.id),
            label: plainString(item.label),
            gradeBand: nullableString(item.gradeBand),
          };
        })
      : [],
    source: plainString(resolution.source),
    status: plainString(resolution.status, "needs_review"),
    affectedRows: Array.isArray(resolution.affectedRows)
      ? resolution.affectedRows.filter((row): row is number => typeof row === "number")
      : [],
    note: nullableString(resolution.note),
    contextGradeIds: stringArray(resolution.contextGradeIds),
    resolutionClass: nullableString(resolution.resolutionClass),
    requiresHumanConfirmation: Boolean(resolution.requiresHumanConfirmation),
    provenance: Array.isArray(resolution.provenance) ? toPlainJson(resolution.provenance) : [],
  };
}

function serializeClassResolution(value: unknown) {
  const resolution = asPlainRecord(toPlainJson(value));
  return {
    sourceValue: plainString(resolution.sourceValue),
    classGroupId: nullableString(resolution.classGroupId),
    gradeId: nullableString(resolution.gradeId),
    resolvedLabel: nullableString(resolution.resolvedLabel),
    candidateOptions: Array.isArray(resolution.candidateOptions)
      ? resolution.candidateOptions.map((option) => {
          const item = asPlainRecord(toPlainJson(option));
          return { id: plainString(item.id), label: plainString(item.label), gradeId: plainString(item.gradeId) };
        })
      : [],
    source: plainString(resolution.source),
    status: plainString(resolution.status, "needs_review"),
    affectedRows: Array.isArray(resolution.affectedRows)
      ? resolution.affectedRows.filter((row): row is number => typeof row === "number")
      : [],
    occupiedTeacherId: nullableString(resolution.occupiedTeacherId),
    occupiedTeacherName: nullableString(resolution.occupiedTeacherName),
    homeroomDecision: nullableString(resolution.homeroomDecision),
    note: nullableString(resolution.note),
    provenance: Array.isArray(resolution.provenance) ? toPlainJson(resolution.provenance) : [],
  };
}

export function serializeTeacherImportJob(job: ITeacherImportJob) {
  const candidate = job as unknown as { toObject?: (options?: { flattenMaps?: boolean }) => unknown };
  const plain = asPlainRecord(
    typeof candidate.toObject === "function"
      ? candidate.toObject({ flattenMaps: true })
      : job
  );
  const parsedRows = Array.isArray(plain.parsedRows) ? plain.parsedRows.map(serializeRow) : [];
  const legacyRows = parsedRows.some((row) => row.issues.some((item) => item.code === "legacy_import_needs_reanalysis"));
  const analysisWarnings = Array.isArray(plain.analysisWarnings)
    ? plain.analysisWarnings.map(serializeIssue)
    : [];
  if (legacyRows && !analysisWarnings.some((item) => item.code === "legacy_import_needs_reanalysis")) {
    analysisWarnings.push({
      code: "legacy_import_needs_reanalysis",
      message: "This import was created by an older import version and needs to be re-analysed/re-uploaded.",
      field: null,
      value: null,
      affectedRows: [],
    });
  }

  return {
    id: plainString(plain._id),
    status: plainString(plain.status),
    workflow: plainString(plain.workflow, "legacy_relationship_review"),
    fileName: plainString(plain.fileName),
    mimeType: nullableString(plain.mimeType),
    selectedSheetName: nullableString(plain.selectedSheetName),
    availableSheets: Array.isArray(plain.availableSheets) ? toPlainJson(plain.availableSheets) : [],
    sheetSelectionRequired: Boolean(plain.sheetSelectionRequired),
    columnMappings: Array.isArray(plain.columnMappings) ? plain.columnMappings.map(serializeColumnMapping) : [],
    parsedRows,
    subjectResolutions: Array.isArray(plain.subjectResolutions) ? plain.subjectResolutions.map(serializeSubjectResolution) : [],
    classResolutions: Array.isArray(plain.classResolutions) ? plain.classResolutions.map(serializeClassResolution) : [],
    analysisSummary: plain.analysisSummary ? toPlainJson(plain.analysisSummary) : null,
    analysisWarnings,
    analysisErrors: Array.isArray(plain.analysisErrors) ? plain.analysisErrors.map(serializeIssue) : [],
    invitationMode: plainString(plain.invitationMode, "send_now"),
    approvedAt: plain.approvedAt ? toPlainJson(plain.approvedAt) : null,
    committedAt: plain.committedAt ? toPlainJson(plain.committedAt) : null,
    result: plain.result ? toPlainJson(plain.result) : null,
    leoAnalysis: plain.leoAnalysis ? toPlainJson(plain.leoAnalysis) : null,
    importSchemaVersion: plain.importSchemaVersion ?? null,
    analysisVersion: plain.analysisVersion ?? null,
    workbookInspection: plain.workbookInspection ? toPlainJson(plain.workbookInspection) : null,
    columnInterpretations: Array.isArray(plain.columnInterpretations) ? toPlainJson(plain.columnInterpretations) : [],
    analysisIssues: Array.isArray(plain.analysisIssues) ? toPlainJson(plain.analysisIssues) : [],
    naturalLanguageResolutions: Array.isArray(plain.naturalLanguageResolutions) ? toPlainJson(plain.naturalLanguageResolutions) : [],
    relationshipPlans: Array.isArray(plain.relationshipPlans) ? toPlainJson(plain.relationshipPlans) : [],
    attentionReview: plain.attentionReview ? toPlainJson(plain.attentionReview) : null,
    compatibility: importCompatibility(job as unknown as Record<string, unknown>),
    review: buildImportReviewDto({ domain: "teacher", job: plain }),
    createdAt: plain.createdAt ? toPlainJson(plain.createdAt) : null,
    updatedAt: plain.updatedAt ? toPlainJson(plain.updatedAt) : null,
  };
}

export async function persistAndEnqueueTeacherImportAnalysis(input: {
  schoolId: mongoose.Types.ObjectId;
  createdByUserId: mongoose.Types.ObjectId;
  fileName: string;
  mimeType?: string | null;
  fileBytes: Buffer;
  workflow?: TeacherImportWorkflow;
}) {
  if (!input.fileBytes.length) throw new Error("File is empty");
  if (input.fileBytes.length > TEACHER_IMPORT_MAX_BYTES) throw new Error("File is too large. Maximum size is 5MB.");

  await assertNoActiveImportDraft({ model: TeacherImportJob, schoolId: input.schoolId, createdByUserId: input.createdByUserId });

  let domain: TeacherImportDoc;
  try {
    domain = await TeacherImportJob.create({
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      status: "uploaded",
      workflow: input.workflow || "identity_setup_v1",
      fileName: input.fileName,
      mimeType: input.mimeType || null,
      fileBytes: input.fileBytes,
      invitationMode: "send_now",
      ...importVersionFields(),
      analysisIssues: [],
      naturalLanguageResolutions: [],
    });
  } catch (error) {
    throw new TeacherImportUploadWriteError("teacher_import_create", error);
  }

  let queued: Awaited<ReturnType<typeof enqueueBackgroundJob>>;
  try {
    queued = await enqueueBackgroundJob({
      kind: "BULK_IMPORT",
      schoolId: input.schoolId,
      initiatedByUserId: input.createdByUserId,
      notificationTargetUserId: input.createdByUserId,
      subjectType: "TeacherImportJob",
      subjectId: domain._id,
      idempotencyKey: `teacher-import-analysis:${String(input.schoolId)}:${String(domain._id)}`,
      input: { teacherImportJobId: String(domain._id), teacherImportPhase: "analysis" },
    });
  } catch (error) {
    throw new TeacherImportUploadWriteError("background_job_enqueue", error, {
      teacherImportJobId: domain._id,
    });
  }
  domain.analysisBackgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  try {
    await domain.save();
  } catch (error) {
    throw new TeacherImportUploadWriteError("teacher_import_link", error, {
      teacherImportJobId: domain._id,
      backgroundJobId: queued.jobId,
    });
  }
  return { job: domain, jobId: queued.jobId, teacherImportJobId: String(domain._id) };
}

export async function enqueueTeacherImportCommit(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherImportJobId: mongoose.Types.ObjectId;
  approvedByUserId: mongoose.Types.ObjectId;
  invitationMode: TeacherImportInvitationMode;
}) {
  const preview = await TeacherImportJob.findOne({ _id: input.teacherImportJobId, schoolId: input.schoolId });
  if (!preview) throw new Error("Teacher import not found");
  if (preview.status !== "review_ready") throw new Error("This teacher import is not ready for confirmation.");
  const reviewState = getTeacherImportReviewState(preview);
  console.info("teacher_import_review_state", { importJobId: String(preview._id), totalRows: reviewState.totalRows, readyCount: reviewState.readyCount, attentionCount: reviewState.attentionCount, blockedCount: reviewState.blockedCount, openIssueCount: reviewState.unresolvedIssues.length });
  if (!reviewState.canProceedToFinalConfirmation) {
    throw new Error("Resolve all blocked and review items before confirming the teacher import.");
  }
  const approvedAt = new Date();
  const domain = await TeacherImportJob.findOneAndUpdate(
    { _id: input.teacherImportJobId, schoolId: input.schoolId, status: "review_ready" },
    {
      $set: {
        invitationMode: input.invitationMode,
        approvedByUserId: input.approvedByUserId,
        approvedAt,
        status: "committing",
      },
    },
    { new: true }
  );
  if (!domain) throw new Error("This teacher import is already being confirmed or is no longer available.");
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
    await TeacherImportJob.updateOne(
      { _id: domain._id, schoolId: input.schoolId, status: "committing", approvedAt },
      { $set: { status: "review_ready", approvedAt: null, approvedByUserId: null } }
    );
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
    const result = claimed.workflow === "identity_setup_v1"
      ? await analyzeTeacherIdentityImport({
          schoolId: claimed.schoolId,
          fileName: claimed.fileName,
          fileBytes: claimed.fileBytes as Buffer,
          selectedSheetName: claimed.selectedSheetName,
          columnMappings: claimed.columnMappings,
        })
      : await analyzeTeacherImport({
          schoolId: claimed.schoolId,
          fileName: claimed.fileName,
          fileBytes: claimed.fileBytes as Buffer,
          selectedSheetName: claimed.selectedSheetName,
          columnMappings: claimed.columnMappings,
          preserved: {
            subjectResolutions: claimed.subjectResolutions,
            classResolutions: claimed.classResolutions,
            analysisIssues: claimed.analysisIssues,
          },
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
    claimed.analysisIssues = result.analysisIssues || [];
    claimed.columnInterpretations = result.columnInterpretations || claimed.columnInterpretations || [];
    claimed.leoAnalysis = result.leoAnalysis || null;
    claimed.importSchemaVersion = importVersionFields().importSchemaVersion;
    claimed.analysisVersion = importVersionFields().analysisVersion;
    claimed.analysisIssues = buildImportReviewDto({ domain: "teacher", job: claimed.toObject({ flattenMaps: true }) as unknown as Record<string, unknown> }).currentIssues;
    if (claimed.leoAnalysis) claimed.leoAnalysis = { ...claimed.leoAnalysis, attempts: Number(claimed.leoAnalysis.attempts || 0) + 1 };
    await claimed.save();
    return { teacherImportJobId: id, status: claimed.status, totalRows: claimed.parsedRows.length, notification: { title: "Teacher import ready for review", body: "Leo and deterministic checks prepared a teacher import review. No teachers were created yet." } };
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

async function commitExplicitTeacherAssignments(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  assignments: ITeacherImportParsedRow["explicitAssignments"];
  assignedBy: mongoose.Types.ObjectId;
}) {
  const resolved = input.assignments.filter((item) => item.status === "resolved" && item.subjectOfferingId && item.classGroupId);
  if (!resolved.length) return;
  const period = await AcademicPeriod.findOne({ schoolId: input.schoolId, isCurrent: true }).select("_id").lean();
  if (!period) throw new Error("Set a current academic period before committing explicit teacher class assignments.");
  for (const assignment of resolved) {
    const subjectOffering = await SubjectOffering.findOne({
      _id: assignment.subjectOfferingId,
      schoolId: input.schoolId,
      isActive: true,
    }).select("_id subjectId").lean();
    const classGroup = await ClassGroup.findOne({ _id: assignment.classGroupId, schoolId: input.schoolId }).select("_id").lean();
    if (!subjectOffering || !classGroup) throw new Error(`An explicit teacher assignment from row ${assignment.sourceValue} is no longer available in this school.`);
    try {
      await TeacherAssignment.create({
        schoolId: input.schoolId,
        teacherId: input.teacherId,
        academicPeriodId: period._id,
        subjectId: subjectOffering.subjectId,
        subjectOfferingId: subjectOffering._id,
        classGroupId: classGroup._id,
        workloadHours: 0,
        status: "active",
        assignedBy: input.assignedBy,
        assignedAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
  }
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
        try {
          await commitExplicitTeacherAssignments({ schoolId: job.schoolId, teacherId: duplicate._id, assignments: row.explicitAssignments, assignedBy: job.approvedByUserId || job.createdByUserId });
          await markRow(job, index, { rowState: "existing", teacherId: String(duplicate._id), commitError: "Already exists; skipped without overwriting." });
          existing += 1;
        } catch (error) {
          failed += 1;
          await markRow(job, index, { rowState: "failed", teacherId: String(duplicate._id), commitError: error instanceof Error ? error.message.slice(0, 1000) : "Teacher assignment failed" });
        }
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
      await commitExplicitTeacherAssignments({ schoolId: job.schoolId, teacherId: teacher._id, assignments: row.explicitAssignments, assignedBy: job.approvedByUserId || job.createdByUserId });
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
  return { teacherImportJobId: id, status: job.status, result: job.result, notification: { title: job.status === "completed" ? "Teacher import completed" : "Teacher import completed with issues", body: job.status === "completed" ? "The confirmed teacher import finished successfully." : "The confirmed teacher import finished with row-level issues." } };
}
