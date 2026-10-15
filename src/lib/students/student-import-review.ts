import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import type { IStudentImportJob, IStudentImportParsedRow } from "@/models/StudentImportJob";
import { parseStudentImportDate } from "@/lib/students/student-import-parse";
import { analyzeStudentImport } from "@/lib/students/analyze-student-import";

export type StudentImportReviewInput = {
  selectedSheetName?: string | null;
  dateFormat?: "auto" | "dmy" | "mdy";
  classConflictPolicy?: "review" | "use_target";
  gradeResolutions?: Array<{ sourceValue: string; gradeId: string | null }>;
  classResolutions?: Array<{ sourceValue: string; gradeId?: string | null; classGroupId: string | null }>;
  rows?: Array<{ sourceRowNumber: number; firstName?: string; middleName?: string | null; lastName?: string; admissionNo?: string | null; sex?: "male" | "female" | null; dateOfBirth?: string | null; enrolledAt?: string | null; status?: "active" | "inactive" | "withdrawn" | "graduated"; gradeId?: string | null; classGroupId?: string | null }>;
};
const validId = (value: unknown) => mongoose.isValidObjectId(String(value || ""));
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export async function applyStudentImportReview(job: IStudentImportJob, input: StudentImportReviewInput) {
  const selectedSheetName = input.selectedSheetName === undefined ? job.selectedSheetName : input.selectedSheetName;
  if (selectedSheetName && !(job.availableSheets || []).some((sheet) => sheet.name === selectedSheetName)) throw new Error("Selected worksheet is not available in this import.");
  const dateFormat = input.dateFormat || job.dateFormat;
  const classConflictPolicy = input.classConflictPolicy || job.classConflictPolicy;
  const mustReanalyze = selectedSheetName !== job.selectedSheetName || dateFormat !== job.dateFormat || classConflictPolicy !== job.classConflictPolicy;
  if (mustReanalyze) {
    if (!job.fileBytes?.length) throw new Error("The uploaded file is unavailable. Upload it again to change worksheet or import settings.");
    const result = await analyzeStudentImport({ schoolId: job.schoolId, fileName: job.fileName, fileBytes: job.fileBytes, selectedSheetName, dateFormat, placementMode: job.placementMode, fixedGradeId: job.fixedGradeId, fixedClassGroupId: job.fixedClassGroupId, classConflictPolicy });
    Object.assign(job, result);
  }
  job.dateFormat = dateFormat;
  job.classConflictPolicy = classConflictPolicy;
  const grades = await Grade.find({ schoolId: job.schoolId, isActive: true }).select("_id name").lean();
  const classes = await ClassGroup.find({ _id: { $in: (input.classResolutions || []).map((item) => item.classGroupId).filter(validId) }, schoolId: job.schoolId, isActive: true }).select("_id name gradeId capacity").lean();
  const gradeById = new Map(grades.map((item) => [String(item._id), item])); const classById = new Map(classes.map((item) => [String(item._id), item]));
  const gradeMap = new Map((input.gradeResolutions || []).map((item) => [normalize(item.sourceValue), item.gradeId && gradeById.has(item.gradeId) ? item.gradeId : null]));
  const classMap = new Map((input.classResolutions || []).map((item) => [normalize(`${item.gradeId || ""}::${item.sourceValue}`), item.classGroupId && classById.has(item.classGroupId) ? item.classGroupId : null]));
  const classBySource = new Map((input.classResolutions || []).map((item) => [normalize(item.sourceValue), item.classGroupId && classById.has(item.classGroupId) ? item.classGroupId : null]));
  const rowEdits = new Map((input.rows || []).map((row) => [row.sourceRowNumber, row]));
  for (const row of job.parsedRows) {
    const edit = rowEdits.get(row.sourceRowNumber); if (edit) Object.assign(row, Object.fromEntries(Object.entries(edit).filter(([key]) => key !== "sourceRowNumber" && edit[key as keyof typeof edit] !== undefined)));
    if (job.placementMode === "class_scoped" && job.fixedClassGroupId) { row.classGroupId = String(job.fixedClassGroupId); row.gradeId = String(job.fixedGradeId); if (job.classConflictPolicy === "use_target") { row.className = job.fixedClassLabel || row.className; row.issues = row.issues.filter((item) => item.code !== "fixed_class_conflict"); } }
    else {
      if (!row.gradeId && row.gradeName) row.gradeId = gradeMap.get(normalize(row.gradeName)) || null;
      const classId = row.className ? classMap.get(normalize(`${row.gradeId || ""}::${row.className}`)) || classMap.get(normalize(`::${row.className}`)) || classBySource.get(normalize(row.className)) : null;
      if (classId) row.classGroupId = classId;
      const selectedClass = row.classGroupId ? classById.get(String(row.classGroupId)) : null;
      if (selectedClass) {
        row.gradeId = String(selectedClass.gradeId);
        if (!row.gradeName) row.gradeName = gradeById.get(String(selectedClass.gradeId))?.name || null;
        if (!row.className) row.className = selectedClass.name;
      }
    }
    const issues = row.issues.filter((item) => !["date_invalid", "date_ambiguous", "sex_review", "status_review", "grade_not_found", "class_not_found", "grade_ambiguous", "class_ambiguous", "fixed_class_conflict", "missing_required", "grade_required", "class_required"].includes(item.code));
    if (!row.firstName?.trim() || !row.lastName?.trim()) issues.push({ code: "missing_required", message: "First name and last name are required.", field: "name", value: null, affectedRows: [row.sourceRowNumber] });
    if (!row.gradeId || !validId(row.gradeId)) issues.push({ code: "grade_required", message: "Choose an active school grade.", field: "gradeName", value: row.gradeName || null, affectedRows: [row.sourceRowNumber] });
    if (!row.classGroupId || !validId(row.classGroupId)) issues.push({ code: "class_required", message: "Choose an active school class group.", field: "className", value: row.className || null, affectedRows: [row.sourceRowNumber] });
    if (row.dateOfBirth) { const date = parseStudentImportDate(row.dateOfBirth, job.dateFormat); if (!date) issues.push({ code: "date_ambiguous", message: "Choose a valid date format and date.", field: "dateOfBirth", value: row.dateOfBirth, affectedRows: [row.sourceRowNumber] }); else row.dateOfBirth = date.toISOString().slice(0, 10); }
    if (row.enrolledAt) { const date = parseStudentImportDate(row.enrolledAt, job.dateFormat); if (!date) issues.push({ code: "date_ambiguous", message: "Choose a valid date format and date.", field: "enrolledAt", value: row.enrolledAt, affectedRows: [row.sourceRowNumber] }); else row.enrolledAt = date.toISOString().slice(0, 10); }
    if (row.sex && !["male", "female"].includes(row.sex)) issues.push({ code: "sex_review", message: "Choose male, female, or leave sex blank.", field: "sex", value: String(row.sex), affectedRows: [row.sourceRowNumber] });
    if (!['active','inactive','withdrawn','graduated'].includes(row.status)) issues.push({ code: "status_review", message: "Choose a valid student status.", field: "status", value: String(row.status), affectedRows: [row.sourceRowNumber] });
    row.issues = issues; row.resolutionStatus = issues.length ? (issues.some((item) => ["missing_required", "grade_required", "class_required", "date_ambiguous", "date_invalid"].includes(item.code)) ? "blocked" : "needs_review") : "resolved"; row.rowState = row.resolutionStatus === "resolved" ? (row.rowState === "existing" ? "existing" : "ready") : "pending";
  }
  return job;
}
