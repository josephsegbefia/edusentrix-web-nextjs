import mongoose from "mongoose";
import {
  TEACHER_IMPORT_CANONICAL_FIELDS,
  type TeacherImportCanonicalField,
} from "@/lib/teachers/parse-teacher-import";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import type {
  ITeacherImportClassResolution,
  ITeacherImportColumnMapping,
  ITeacherImportIssue,
  ITeacherImportJob,
  ITeacherImportParsedRow,
  ITeacherImportSubjectResolution,
} from "@/models/TeacherImportJob";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { applyIssueResolution } from "@/lib/import-intelligence/issues";
import type { ImportProposedAction, ImportRowReference } from "@/lib/import-intelligence/types";
import { refreshTeacherImportReviewState } from "@/lib/teachers/teacher-import-review-state";

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function issue(code: string, message: string, field?: string, value?: string): ITeacherImportIssue {
  return { code, message, field: field || null, value: value || null, affectedRows: [] };
}

function refreshRowStatus(row: ITeacherImportParsedRow) {
  if (row.rowState === "existing") {
    row.resolutionStatus = "resolved";
    return;
  }
  const effectiveIssues = row.issues.filter((item) => item.code !== "existing");
  const blocked = effectiveIssues.some((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code));
  const review = effectiveIssues.length > 0;
  row.resolutionStatus = blocked ? "blocked" : review ? "needs_review" : "resolved";
  if (row.rowState !== "created") {
    row.rowState = row.resolutionStatus === "resolved" ? "ready" : "pending";
  }
}

function replaceFieldIssues(row: ITeacherImportParsedRow, field: string, value?: string) {
  row.issues = row.issues.filter((item) => {
    if (item.field !== field) return true;
    if (!value) return false;
    return normalize(item.value || "") !== normalize(value);
  });
}

function markTeacherImportIssuesResolved(input: {
  job: ITeacherImportJob;
  fieldKey: string;
  sourceValue: string;
  rowNumbers: number[];
  actionType: ImportProposedAction["type"];
  selectionRefs?: string[];
  issueTypes?: string[];
}) {
  const rowRefs = new Set(input.rowNumbers.map((rowNumber) => `T${String(rowNumber).padStart(3, "0")}`));
  const sourceKey = normalize(input.sourceValue);
  input.job.analysisIssues = (input.job.analysisIssues || []).map((issue) => {
    if (issue.status !== "open" || issue.fieldKey !== input.fieldKey) return issue;
    if (input.issueTypes && !input.issueTypes.includes(issue.issueType)) return issue;
    if (!issue.sourceValues.some((value) => normalize(value) === sourceKey)) return issue;
    if (!issue.rowRefs.some((rowRef) => rowRefs.has(rowRef))) return issue;
    const action: ImportProposedAction = {
      actionId: `admin_${input.actionType}_${issue.issueId}`,
      type: input.actionType,
      issueId: issue.issueId,
      rowRefs: issue.rowRefs as ImportRowReference[],
      selectionRefs: input.selectionRefs || [],
      sourceValue: input.sourceValue,
    };
    return applyIssueResolution({ issue, action, source: "admin" });
  });
}

function normalizedStatus(value: string | null | undefined) {
  const key = normalize(value || "");
  const aliases: Record<string, "active" | "inactive" | "on_leave" | "terminated"> = {
    active: "active", employed: "active", current: "active", working: "active",
    inactive: "inactive", former: "inactive", leave: "on_leave", onleave: "on_leave",
    terminated: "terminated", dismissed: "terminated",
  };
  return aliases[key] || null;
}

export type TeacherImportReviewInput = {
  selectedSheetName?: string | null;
  rows?: Array<{
    sourceRowNumber: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    employeeId?: string | null;
    status?: string | null;
  }>;
  columnMappings?: Array<{ sourceHeader: string; canonicalField: TeacherImportCanonicalField | null }>;
  subjectResolutions?: Array<{ resolutionKey: string; subjectOfferingIds: string[]; ignored?: boolean }>;
  /** A future review surface can submit one decision for a stable issue group. */
  groupedSubjectResolutions?: Array<{ issueId: string; subjectOfferingIds: string[]; ignored?: boolean }>;
  classResolutions?: Array<{ sourceValue: string; classGroupId?: string | null; homeroomDecision: "keep_existing" | "replace" | "no_assign" }>;
};

export type TeacherImportIssueAction =
  | { issueId: string; expectedUpdatedAt?: string | null; type: "select_subject"; subjectOfferingId: string }
  | { issueId: string; expectedUpdatedAt?: string | null; type: "ignore_subject" }
  | { issueId: string; expectedUpdatedAt?: string | null; type: "keep_recognised_subject" }
  | { issueId: string; expectedUpdatedAt?: string | null; type: "set_email"; email: string };

function reviewMappings(
  job: ITeacherImportJob,
  mappings: TeacherImportReviewInput["columnMappings"]
): ITeacherImportColumnMapping[] {
  const knownHeaders = new Set([
    ...(job.columnMappings || []).map((mapping) => mapping.sourceHeader),
    ...job.parsedRows.flatMap((row) => Object.keys(row.sourceValues || {})),
  ]);
  const byHeader = new Map((mappings || []).map((mapping) => [mapping.sourceHeader, mapping]));
  return [...knownHeaders].map((sourceHeader) => {
    const mapping = byHeader.get(sourceHeader);
    if (mapping && mapping.canonicalField && !TEACHER_IMPORT_CANONICAL_FIELDS.includes(mapping.canonicalField)) {
      throw new Error("A selected column mapping is not supported.");
    }
    return {
      sourceHeader,
      canonicalField: mapping?.canonicalField || null,
      source: "admin" as const,
      confidence: mapping?.canonicalField ? 1 : 0,
      status: mapping?.canonicalField ? "resolved" as const : "needs_review" as const,
    };
  });
}

function mappingsDiffer(
  current: ITeacherImportColumnMapping[],
  next: ITeacherImportColumnMapping[]
) {
  const fields = (mappings: ITeacherImportColumnMapping[]) =>
    [...mappings]
      .map((mapping) => `${mapping.sourceHeader}\u0000${mapping.canonicalField || ""}`)
      .sort();
  const left = fields(current);
  const right = fields(next);
  return left.length !== right.length || left.some((value, index) => value !== right[index]);
}

async function reanalyzeForReview(
  job: ITeacherImportJob,
  input: TeacherImportReviewInput
) {
  const requestedSheet = input.selectedSheetName === undefined
    ? job.selectedSheetName
    : input.selectedSheetName;
  if (input.selectedSheetName !== undefined && !requestedSheet) {
    throw new Error("Choose a worksheet before reanalysing this import.");
  }
  if (requestedSheet && !(job.availableSheets || []).some((sheet) => sheet.name === requestedSheet)) {
    throw new Error("Selected worksheet is not available in this import.");
  }
  const nextMappings = input.columnMappings
    ? reviewMappings(job, input.columnMappings)
    : job.columnMappings || [];
  const needsAnalysis =
    (input.selectedSheetName !== undefined && requestedSheet !== job.selectedSheetName) ||
    (input.columnMappings !== undefined && mappingsDiffer(job.columnMappings || [], nextMappings));
  if (!needsAnalysis) return;
  if (!job.fileBytes?.length) {
    throw new Error("The uploaded file is unavailable. Upload it again to change the worksheet or column mappings.");
  }
  const result = await analyzeTeacherImport({
    schoolId: job.schoolId,
    fileName: job.fileName,
    fileBytes: job.fileBytes,
    selectedSheetName: requestedSheet,
    columnMappings: nextMappings,
    preserved: {
      subjectResolutions: job.subjectResolutions,
      classResolutions: job.classResolutions,
      analysisIssues: job.analysisIssues,
    },
  });
  job.selectedSheetName = result.selectedSheetName;
  job.availableSheets = result.availableSheets;
  job.sheetSelectionRequired = result.sheetSelectionRequired;
  job.columnMappings = result.columnMappings;
  job.parsedRows = result.parsedRows;
  job.subjectResolutions = result.subjectResolutions;
  job.classResolutions = result.classResolutions;
  job.analysisSummary = result.analysisSummary;
  job.analysisWarnings = result.analysisWarnings;
  job.analysisErrors = result.analysisErrors;
  job.analysisIssues = result.analysisIssues || job.analysisIssues || [];
  job.columnInterpretations = result.columnInterpretations || job.columnInterpretations || [];
}

export async function applyTeacherImportReview(job: ITeacherImportJob, input: TeacherImportReviewInput) {
  await reanalyzeForReview(job, input);
  if (input.rows?.length) {
    for (const update of input.rows) {
      const row = job.parsedRows.find((item) => item.sourceRowNumber === update.sourceRowNumber);
      if (!row) continue;
      if (update.firstName !== undefined) row.firstName = update.firstName.trim();
      if (update.lastName !== undefined) row.lastName = update.lastName.trim();
      if (update.email !== undefined) row.email = update.email.trim().toLowerCase();
      if (update.phone !== undefined) row.phone = update.phone?.trim() || null;
      if (update.employeeId !== undefined) row.employeeId = update.employeeId?.trim() || null;
      if (update.status !== undefined) row.status = update.status?.trim() || "active";
      row.issues = row.issues.filter((item) => !["name", "email", "status"].includes(item.field || ""));
      if (!row.firstName || !row.lastName) row.issues.push(issue("missing_required", "Add a first and last name before confirming this row.", "name"));
      if (!row.email) row.issues.push(issue("missing_required", "Choose the column containing each teacher's email address.", "email"));
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.issues.push(issue("invalid", "Enter a valid email address.", "email", row.email));
      const canonicalStatus = normalizedStatus(row.status);
      if (canonicalStatus) row.status = canonicalStatus;
      else row.issues.push(issue("status_review", `Employment status "${row.status || ""}" needs confirmation.`, "status", row.status || ""));
      refreshRowStatus(row);
    }
  }
  const groupedSubjectResolutions = (input.groupedSubjectResolutions || []).flatMap((grouped) => {
    const issue = (job.analysisIssues || []).find((item) => item.issueId === grouped.issueId);
    if (!issue || issue.status !== "open" || issue.scope !== "group" || issue.fieldKey !== "subjects" || issue.resolutionClass !== "REVIEW") {
      throw new Error("The selected subject review group is no longer available.");
    }
    const rowNumbers = new Set(issue.rowRefs.map((rowRef) => Number(rowRef.slice(1))));
    const sourceKey = normalize(issue.sourceValues[0] || "");
    const resolutions = (job.subjectResolutions || []).filter((resolution) =>
      normalize(resolution.sourceValue) === sourceKey &&
      resolution.affectedRows.some((rowNumber) => rowNumbers.has(rowNumber))
    );
    if (!resolutions.length) throw new Error("The grouped subject decision no longer has matching source rows.");
    return resolutions.map((resolution) => ({
      resolutionKey: resolution.resolutionKey,
      subjectOfferingIds: grouped.subjectOfferingIds,
      ignored: grouped.ignored,
    }));
  });
  const requestedSubjectResolutions = [...(input.subjectResolutions || []), ...groupedSubjectResolutions];
  if (requestedSubjectResolutions.length) {
    const validIds = Array.from(new Set([
      ...requestedSubjectResolutions.flatMap((resolution) => resolution.subjectOfferingIds),
      ...(job.subjectResolutions || []).flatMap((resolution) => resolution.subjectOfferingIds),
    ])).filter((value) => mongoose.isValidObjectId(value));
    const offerings = await SubjectOffering.find({ _id: { $in: validIds }, schoolId: job.schoolId, isActive: true }).select("_id subjectId displayName subjectFamily").lean();
    const offeringById = new Map(offerings.map((offering) => [String(offering._id), offering]));
    for (const resolutionInput of requestedSubjectResolutions) {
      const resolution = (job.subjectResolutions || []).find((item) => item.resolutionKey === resolutionInput.resolutionKey);
      if (!resolution) continue;
      const selected = resolutionInput.subjectOfferingIds.map((id) => offeringById.get(id)).filter(Boolean);
      if (!resolutionInput.ignored && selected.length !== resolutionInput.subjectOfferingIds.length) {
        throw new Error("One or more selected subject offerings are invalid or belong to another school.");
      }
      if (!resolutionInput.ignored && selected.length === 0) {
        resolution.source = "admin";
        resolution.status = "needs_review";
        resolution.note = "Choose an offering or explicitly ignore this subject.";
        continue;
      }
      const compatibleOfferingIds = new Set((resolution.candidateOptions || []).map((candidate) => candidate.id));
      if (!resolutionInput.ignored && compatibleOfferingIds.size && selected.some((offering) => !compatibleOfferingIds.has(String(offering?._id)))) {
        throw new Error("A selected subject offering is not compatible with this import row's grade context.");
      }
      const previousOfferingIds = [...resolution.subjectOfferingIds];
      const previousSubjectIds = previousOfferingIds
        .map((id) => offeringById.get(id)?.subjectId)
        .filter(Boolean)
        .map(String);
      resolution.source = "admin";
      resolution.status = resolutionInput.ignored ? "ignored" : "resolved";
      resolution.subjectOfferingIds = selected.map((item) => String(item?._id));
      resolution.resolvedNames = selected.map((item) => String(item?.displayName));
      resolution.note = resolutionInput.ignored ? "Ignored by administrator; it will not be attached to the teacher." : "Selected by administrator.";
      resolution.provenance = [
        ...(resolution.provenance || []),
        {
          field: "subjects",
          sourceValue: resolution.sourceValue,
          source: "admin",
          note: resolution.note,
        },
      ];
      for (const row of job.parsedRows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
        row.subjectOfferingIds = Array.from(new Set([
          ...row.subjectOfferingIds.filter((id) => !previousOfferingIds.includes(id)),
          ...resolution.subjectOfferingIds,
        ]));
        row.subjectIds = Array.from(new Set([
          ...row.subjectIds.filter((id) => !previousSubjectIds.includes(id)),
          ...selected.map((item) => String(item?.subjectId)),
        ]));
        if (resolutionInput.ignored) {
          row.subjects = row.subjects.filter((value) => normalize(value) !== normalize(resolution.sourceValue));
        }
        row.provenance = [
          ...(row.provenance || []),
          {
            field: "subjects",
            sourceValue: resolution.sourceValue,
            source: "admin",
            note: resolution.note,
          },
        ];
        replaceFieldIssues(row, "subjects", resolution.sourceValue);
        refreshRowStatus(row);
      }
      markTeacherImportIssuesResolved({
        job,
        fieldKey: "subjects",
        sourceValue: resolution.sourceValue,
        rowNumbers: resolution.affectedRows,
        actionType: resolutionInput.ignored ? "ignore_source_value" : "select_catalog_item",
        selectionRefs: resolution.subjectOfferingIds,
        issueTypes: ["subject_unresolved", "semantic_substitution_review", "ambiguous"],
      });
    }
  }

  if (input.classResolutions?.length) {
    const validIds = input.classResolutions.map((resolution) => resolution.classGroupId).filter((value): value is string => Boolean(value) && mongoose.isValidObjectId(value));
    const classes = await ClassGroup.find({ _id: { $in: validIds }, schoolId: job.schoolId, isActive: true }).select("_id gradeId name").lean();
    const classById = new Map(classes.map((item) => [String(item._id), item]));
    for (const resolutionInput of input.classResolutions) {
      const resolution = (job.classResolutions || []).find((item) => normalize(item.sourceValue) === normalize(resolutionInput.sourceValue));
      if (!resolution) continue;
      if (resolutionInput.classGroupId && !classById.has(resolutionInput.classGroupId)) {
        throw new Error("The selected homeroom class is invalid or belongs to another school.");
      }
      resolution.source = "admin";
      resolution.status = "resolved";
      resolution.classGroupId = resolutionInput.classGroupId || null;
      resolution.homeroomDecision = resolutionInput.homeroomDecision;
      resolution.note = `Homeroom decision: ${resolutionInput.homeroomDecision}.`;
      for (const row of job.parsedRows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
        row.homeroomClassGroupId = resolutionInput.homeroomDecision === "replace" ? resolutionInput.classGroupId || null : null;
        replaceFieldIssues(row, "homeroomClass", resolution.sourceValue);
        refreshRowStatus(row);
      }
      markTeacherImportIssuesResolved({
        job,
        fieldKey: "homeroomClass",
        sourceValue: resolution.sourceValue,
        rowNumbers: resolution.affectedRows,
        actionType: resolutionInput.homeroomDecision === "no_assign" ? "remove_association" : resolutionInput.homeroomDecision === "keep_existing" ? "keep_existing" : "associate_context",
        selectionRefs: resolutionInput.classGroupId ? [resolutionInput.classGroupId] : [],
      });
    }
  }

  if (job.analysisSummary) {
    refreshTeacherImportReviewState(job);
    job.analysisSummary.warnings = job.parsedRows.reduce((count, row) => count + row.issues.length, 0);
    job.analysisSummary.errors = job.parsedRows.reduce((count, row) => count + row.issues.filter((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code)).length, 0);
  }
  return job;
}

/** Applies one visible V2 review decision. The server owns all linked rows. */
export async function applyTeacherImportIssueAction(job: ITeacherImportJob, input: TeacherImportIssueAction) {
  const reviewIssue = (job.analysisIssues || []).find((item) => item.issueId === input.issueId);
  if (!reviewIssue) throw new Error("This review decision no longer exists. Refresh the import and try again.");
  if (input.expectedUpdatedAt && reviewIssue.updatedAt !== input.expectedUpdatedAt) {
    throw new Error("This decision changed in another tab. Refresh the import before applying your choice.");
  }
  if (reviewIssue.status !== "open") return job;
  if (input.type === "select_subject" || input.type === "ignore_subject") {
    if (reviewIssue.fieldKey !== "subjects") throw new Error("This decision does not accept a subject choice.");
    if (reviewIssue.scope === "group") {
      await applyTeacherImportReview(job, {
        groupedSubjectResolutions: [{
          issueId: reviewIssue.issueId,
          subjectOfferingIds: input.type === "select_subject" ? [input.subjectOfferingId] : [],
          ignored: input.type === "ignore_subject",
        }],
      });
    } else if (reviewIssue.issueType === "stage_mismatch") {
      const targetRows = new Set(reviewIssue.rowRefs.map((ref) => Number(ref.slice(1))));
      if (input.type === "select_subject") {
        const resolutions = job.subjectResolutions.filter((resolution) => normalize(resolution.sourceValue) === normalize(reviewIssue.sourceValues[0] || "") && resolution.affectedRows.some((rowNumber) => targetRows.has(rowNumber)));
        if (!resolutions.length) throw new Error("No compatible source subject is available for this mismatch.");
        await applyTeacherImportReview(job, { subjectResolutions: resolutions.map((resolution) => ({ resolutionKey: resolution.resolutionKey, subjectOfferingIds: [input.subjectOfferingId] })) });
      }
      for (const row of job.parsedRows.filter((item) => targetRows.has(item.sourceRowNumber))) {
        if (input.type === "ignore_subject") row.subjects = row.subjects.filter((value) => normalize(value) !== normalize(reviewIssue.sourceValues[0] || ""));
        row.issues = row.issues.filter((item) => !(item.code === "stage_mismatch" && item.field === "subjects" && normalize(item.value || "") === normalize(reviewIssue.sourceValues[0] || "")));
        refreshRowStatus(row);
      }
      const action: ImportProposedAction = { actionId: `admin_select_subject_${reviewIssue.issueId}`, type: "select_catalog_item", issueId: reviewIssue.issueId, rowRefs: reviewIssue.rowRefs as ImportRowReference[], selectionRefs: input.type === "select_subject" ? [input.subjectOfferingId] : [] };
      job.analysisIssues = (job.analysisIssues || []).map((item) => item.issueId === reviewIssue.issueId ? applyIssueResolution({ issue: item, action, source: "admin" }) : item);
      refreshTeacherImportReviewSummary(job);
    } else {
      throw new Error("This subject decision must be resolved with a compatible manual option.");
    }
    return job;
  }
  const targetRows = new Set(reviewIssue.rowRefs.map((ref) => Number(ref.slice(1))));
  if (input.type === "set_email") {
    if (reviewIssue.fieldKey !== "email") throw new Error("This decision does not accept an email address.");
    await applyTeacherImportReview(job, {
      rows: [...targetRows].map((sourceRowNumber) => ({ sourceRowNumber, email: input.email })),
    });
  } else if (input.type === "keep_recognised_subject") {
    if (reviewIssue.issueType !== "stage_mismatch") throw new Error("This action is only available for a recognised subject mismatch.");
    for (const row of job.parsedRows.filter((item) => targetRows.has(item.sourceRowNumber))) {
      row.issues = row.issues.filter((item) => !(item.code === "stage_mismatch" && item.field === "subjects" && normalize(item.value || "") === normalize(reviewIssue.sourceValues[0] || "")));
      row.provenance = [...(row.provenance || []), { field: "subjects", sourceValue: reviewIssue.sourceValues[0] || null, source: "admin", note: "Administrator kept the existing validated subject association." }];
      refreshRowStatus(row);
    }
  }
  const action: ImportProposedAction = {
    actionId: `admin_${input.type}_${reviewIssue.issueId}`,
    type: input.type === "set_email" ? "set_field_value" : "keep_existing",
    issueId: reviewIssue.issueId,
    rowRefs: reviewIssue.rowRefs as ImportRowReference[],
    ...(input.type === "set_email" ? { fieldKey: "email", value: input.email } : { fieldKey: "subjects" }),
  };
  job.analysisIssues = (job.analysisIssues || []).map((item) => item.issueId === reviewIssue.issueId
    ? applyIssueResolution({ issue: item, action, source: "admin" })
    : item);
  refreshTeacherImportReviewSummary(job);
  return job;
}

export function reopenTeacherImportIssue(job: ITeacherImportJob, input: { issueId: string; expectedUpdatedAt?: string | null }) {
  const reviewIssue = (job.analysisIssues || []).find((item) => item.issueId === input.issueId);
  if (!reviewIssue) throw new Error("This review decision no longer exists.");
  if (input.expectedUpdatedAt && reviewIssue.updatedAt !== input.expectedUpdatedAt) throw new Error("This decision changed in another tab. Refresh the import before reopening it.");
  if (reviewIssue.status === "open") return job;
  const targetRows = new Set(reviewIssue.rowRefs.map((ref) => Number(ref.slice(1))));
  if (reviewIssue.fieldKey === "subjects") {
    for (const row of job.parsedRows.filter((item) => targetRows.has(item.sourceRowNumber))) {
      if (!row.issues.some((item) => item.groupedIssueId === reviewIssue.issueId)) {
        row.issues.push(issue(reviewIssue.issueType === "stage_mismatch" ? "stage_mismatch" : "subject_review", reviewIssue.explanation, "subjects", reviewIssue.sourceValues[0] || undefined));
        row.issues[row.issues.length - 1].groupedIssueId = reviewIssue.issueId;
      }
      refreshRowStatus(row);
    }
    for (const resolution of job.subjectResolutions.filter((item) => normalize(item.sourceValue) === normalize(reviewIssue.sourceValues[0] || "") && item.affectedRows.some((rowNumber) => targetRows.has(rowNumber)))) {
      resolution.status = "needs_review";
      resolution.source = "inferred";
      resolution.subjectOfferingIds = [];
      resolution.resolvedNames = [];
      resolution.note = "Reopened by administrator for review.";
    }
  }
  job.analysisIssues = (job.analysisIssues || []).map((item) => item.issueId === reviewIssue.issueId
    ? { ...item, status: "open", resolvedAction: null, resolvedBy: null, updatedAt: new Date().toISOString() }
    : item);
  refreshTeacherImportReviewSummary(job);
  return job;
}

function refreshTeacherImportReviewSummary(job: ITeacherImportJob) {
  refreshTeacherImportReviewState(job);
}
