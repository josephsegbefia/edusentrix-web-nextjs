import mongoose from "mongoose";
import {
  TEACHER_IMPORT_CANONICAL_FIELDS,
  type TeacherImportCanonicalField,
} from "@/lib/teachers/parse-teacher-import";
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

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function split(value: string) {
  return value.split(/[;,|\n]/).map((item) => item.trim()).filter(Boolean);
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
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
  const blocked = effectiveIssues.some((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found", "ambiguous"].includes(item.code));
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
  subjectResolutions?: Array<{ sourceValue: string; subjectOfferingIds: string[]; ignored?: boolean }>;
  classResolutions?: Array<{ sourceValue: string; classGroupId?: string | null; homeroomDecision: "keep_existing" | "replace" | "no_assign" }>;
};

export async function applyTeacherImportReview(job: ITeacherImportJob, input: TeacherImportReviewInput) {
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
  if (input.columnMappings?.length) {
    const knownHeaders = new Set([
      ...(job.columnMappings || []).map((mapping) => mapping.sourceHeader),
      ...job.parsedRows.flatMap((row) => Object.keys(row.sourceValues || {})),
    ]);
    const mappings: ITeacherImportColumnMapping[] = input.columnMappings
      .filter((mapping) => knownHeaders.has(mapping.sourceHeader))
      .map((mapping) => ({
        sourceHeader: mapping.sourceHeader,
        canonicalField: mapping.canonicalField,
        source: "admin" as const,
        confidence: mapping.canonicalField ? 1 : 0,
        status: mapping.canonicalField ? "resolved" as const : "needs_review" as const,
      }));
    const byField = new Map<string, ITeacherImportColumnMapping>();
    for (const mapping of mappings) {
      if (mapping.canonicalField && !TEACHER_IMPORT_CANONICAL_FIELDS.includes(mapping.canonicalField as TeacherImportCanonicalField)) continue;
      if (mapping.canonicalField && !byField.has(mapping.canonicalField)) byField.set(mapping.canonicalField, mapping);
    }
    job.columnMappings = mappings;
    for (const row of job.parsedRows) {
      const values = row.sourceValues || {};
      const read = (field: string) => {
        const mapping = byField.get(field);
        return mapping ? String(values[mapping.sourceHeader] || "").trim() : "";
      };
      const fullName = read("fullName");
      const name = fullName ? splitFullName(fullName) : { firstName: "", lastName: "" };
      row.firstName = read("firstName") || name.firstName;
      row.lastName = read("lastName") || name.lastName;
      row.fullName = fullName || null;
      row.email = read("email").toLowerCase();
      row.phone = read("phone") || null;
      row.employeeId = read("employeeId") || null;
      row.department = read("department") || null;
      row.status = read("status") || "active";
      row.subjects = split(read("subjects"));
      row.homeroomClass = read("homeroomClass") || null;
      row.homeroomGrade = read("homeroomGrade") || null;
      row.homeroomClassGroupId = read("homeroomClassGroupId") || null;
      if (!row.firstName || !row.lastName) row.issues.push(issue("missing_required", "Add a first and last name before confirming this row.", "name"));
      if (!row.email) row.issues.push(issue("missing_required", "Choose the column containing each teacher's email address.", "email"));
      refreshRowStatus(row);
    }
  }

  if (input.subjectResolutions?.length) {
    const validIds = input.subjectResolutions.flatMap((resolution) => resolution.subjectOfferingIds).filter((value) => mongoose.isValidObjectId(value));
    const offerings = await SubjectOffering.find({ _id: { $in: validIds }, schoolId: job.schoolId, isActive: true }).select("_id subjectId displayName subjectFamily").lean();
    const offeringById = new Map(offerings.map((offering) => [String(offering._id), offering]));
    for (const resolutionInput of input.subjectResolutions) {
      const resolution = (job.subjectResolutions || []).find((item) => normalize(item.sourceValue) === normalize(resolutionInput.sourceValue));
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
      resolution.source = "admin";
      resolution.status = resolutionInput.ignored ? "ignored" : "resolved";
      resolution.subjectOfferingIds = selected.map((item) => String(item?._id));
      resolution.resolvedNames = selected.map((item) => String(item?.displayName));
      resolution.note = resolutionInput.ignored ? "Ignored by administrator; it will not be attached to the teacher." : "Selected by administrator.";
      for (const row of job.parsedRows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
        row.subjectOfferingIds = Array.from(new Set([
          ...row.subjectOfferingIds.filter((id) => !resolution.subjectOfferingIds.includes(id)),
          ...resolution.subjectOfferingIds,
        ]));
        row.subjectIds = Array.from(new Set([
          ...row.subjectIds.filter((id) => !selected.some((item) => String(item?.subjectId) === id)),
          ...selected.map((item) => String(item?.subjectId)),
        ]));
        if (resolutionInput.ignored) {
          row.subjects = row.subjects.filter((value) => normalize(value) !== normalize(resolution.sourceValue));
        }
        replaceFieldIssues(row, "subjects", resolution.sourceValue);
        refreshRowStatus(row);
      }
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
    }
  }

  const summary = job.analysisSummary;
  if (summary) {
    summary.readyRows = job.parsedRows.filter((row) => row.rowState === "ready").length;
    summary.needsReviewRows = job.parsedRows.filter((row) => row.resolutionStatus === "needs_review").length;
    summary.blockedRows = job.parsedRows.filter((row) => row.resolutionStatus === "blocked").length;
    summary.warnings = job.parsedRows.reduce((count, row) => count + row.issues.length, 0);
    summary.errors = job.parsedRows.reduce((count, row) => count + row.issues.filter((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found", "ambiguous"].includes(item.code)).length, 0);
  }
  return job;
}
