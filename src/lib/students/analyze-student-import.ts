import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import type { IStudentImportAnalysisSummary, IStudentImportClassResolution, IStudentImportGradeResolution, IStudentImportIssue, IStudentImportJob, IStudentImportParsedRow } from "@/models/StudentImportJob";
import { parseStudentImportDate, parseStudentImportWorkbook } from "@/lib/students/student-import-parse";
import { suggestStudentImportSemantics } from "@/lib/students/student-import-leo";

type GradeRec = { _id: mongoose.Types.ObjectId; name: string; code?: string | null; stage?: string };
type ClassRec = { _id: mongoose.Types.ObjectId; name: string; gradeId: mongoose.Types.ObjectId; capacity?: number | null };
type AnalysisResult = Pick<ITStudentImportAnalysis, "selectedSheetName" | "availableSheets" | "sheetSelectionRequired" | "columnMappings" | "unusedColumns" | "parsedRows" | "gradeResolutions" | "classResolutions" | "dateExamples" | "analysisSummary" | "analysisWarnings" | "analysisErrors">;
type ITStudentImportAnalysis = IStudentImportJob;

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const trim = (value: unknown) => String(value ?? "").trim();
const id = (value: unknown) => String(value || "");
const issue = (code: string, message: string, field?: string, value?: string, affectedRows: number[] = []): IStudentImportIssue => ({ code, message, field: field || null, value: value || null, affectedRows });
const unique = <T,>(values: T[], key: (value: T) => string) => [...new Map(values.map((value) => [key(value), value])).values()];

function gradeAliases(grade: GradeRec) {
  const values = [grade.name, grade.code].filter(Boolean).map(String);
  const aliases = new Set(values.map(normalize));
  const match = grade.name.match(/(creche|nursery|kg|kindergarten|primary|basic|jhs|juniorhigh|shs|seniorhigh)\s*[- ]?([0-9one|two|three|four|five|six|seven|eight|nine|ten]+)/i);
  if (match) {
    const numberWords: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
    const number = numberWords[match[2].toLowerCase()] || match[2];
    const prefix = match[1].toLowerCase().replace(/juniorhigh/g, "jhs").replace(/seniorhigh/g, "shs").replace(/kindergarten/g, "kg").replace(/primary/g, "basic");
    aliases.add(normalize(`${prefix}${number}`)); aliases.add(normalize(`${prefix} ${number}`)); aliases.add(normalize(`${prefix}-${number}`));
  }
  return aliases;
}
function resolveGrade(value: string, grades: GradeRec[]) {
  const normalized = normalize(value); if (!normalized) return [] as GradeRec[];
  return grades.filter((grade) => gradeAliases(grade).has(normalized));
}
function classMatches(value: string, grade: GradeRec | null, classes: ClassRec[]) {
  const normalized = normalize(value); if (!normalized) return [] as ClassRec[];
  const candidates = classes.filter((item) => !grade || id(item.gradeId) === id(grade._id));
  return candidates.filter((item) => {
    const names = [item.name, `${grade?.name || ""} ${item.name}`, item.name.replace(/^class\s+/i, "")].map(normalize);
    return names.includes(normalized);
  });
}
function sex(value: string | null | undefined) {
  const normalized = normalize(trim(value)); if (!normalized) return { value: null as "male" | "female" | null, status: "resolved" as const };
  if (["m","male","boy"].includes(normalized)) return { value: "male" as const, status: "resolved" as const };
  if (["f","female","girl"].includes(normalized)) return { value: "female" as const, status: "resolved" as const };
  return { value: null, status: "needs_review" as const };
}
function status(value: string | null | undefined) {
  const normalized = normalize(trim(value)); if (!normalized) return { value: "active" as const, status: "resolved" as const };
  const map: Record<string, "active" | "inactive" | "withdrawn" | "graduated"> = { active: "active", current: "active", enrolled: "active", inactive: "inactive", suspended: "inactive", withdrawn: "withdrawn", left: "withdrawn", transferred: "withdrawn", graduated: "graduated", alumni: "graduated" };
  return map[normalized] ? { value: map[normalized], status: "resolved" as const } : { value: "active" as const, status: "needs_review" as const };
}
function dateInfo(raw: string | null | undefined, format: "auto" | "dmy" | "mdy") {
  const value = trim(raw); if (!value) return { date: null, status: "resolved" as const, ambiguous: false };
  const dmy = parseStudentImportDate(value, "dmy"); const mdy = parseStudentImportDate(value, "mdy");
  if (!dmy && !mdy) return { date: null, status: "invalid" as const, ambiguous: false };
  if (format === "dmy") return { date: dmy, status: dmy ? "resolved" as const : "invalid" as const, ambiguous: false };
  if (format === "mdy") return { date: mdy, status: mdy ? "resolved" as const : "invalid" as const, ambiguous: false };
  if (dmy && mdy && dmy.getTime() !== mdy.getTime()) return { date: null, status: "ambiguous" as const, ambiguous: true };
  return { date: dmy || mdy, status: "resolved" as const, ambiguous: false };
}
function iso(date: Date | null) { return date ? date.toISOString().slice(0, 10) : null; }
function candidate(idValue: unknown, label: string, grade?: GradeRec | null) { return { id: id(idValue), label, gradeId: grade ? id(grade._id) : null, gradeName: grade?.name || null }; }

export async function analyzeStudentImport(input: { schoolId: mongoose.Types.ObjectId; fileName: string; fileBytes: Buffer; selectedSheetName?: string | null; dateFormat?: "auto" | "dmy" | "mdy"; placementMode: "school_wide" | "class_scoped"; fixedGradeId?: mongoose.Types.ObjectId | null; fixedClassGroupId?: mongoose.Types.ObjectId | null; classConflictPolicy?: "review" | "use_target" }): Promise<AnalysisResult> {
  const parsed = parseStudentImportWorkbook(input.fileBytes, input.fileName, input.selectedSheetName);
  const [grades, classes, existing] = await Promise.all([
    Grade.find({ schoolId: input.schoolId, isActive: true }).select("_id name code stage").lean(),
    ClassGroup.find({ schoolId: input.schoolId, isActive: true }).select("_id name gradeId capacity").lean(),
    Student.find({ schoolId: input.schoolId }).select("_id admissionNo firstName middleName lastName dateOfBirth").lean(),
  ]);
  const gradeRecords = grades as GradeRec[]; const classRecords = classes as ClassRec[];
  const fixedClass = input.fixedClassGroupId ? classRecords.find((item) => id(item._id) === id(input.fixedClassGroupId)) || null : null;
  const fixedGrade = input.fixedGradeId ? gradeRecords.find((item) => id(item._id) === id(input.fixedGradeId)) || null : fixedClass ? gradeRecords.find((item) => id(item._id) === id(fixedClass.gradeId)) || null : null;
  if (input.placementMode === "class_scoped" && (!fixedClass || !fixedGrade)) throw new Error("The selected target class is no longer available in this school.");
  const dateFormat = input.dateFormat || "auto";
  const gradeResolutions = new Map<string, IStudentImportGradeResolution>(); const classResolutions = new Map<string, IStudentImportClassResolution>();
  const rows: IStudentImportParsedRow[] = []; const warnings: IStudentImportIssue[] = []; const errors: IStudentImportIssue[] = []; const dateExamples: IStudentImportJob["dateExamples"] = [];
  const admissions = new Map<string, number[]>(); const names = new Map<string, number[]>();
  for (const source of parsed.rows) {
    const rowIssues: IStudentImportIssue[] = []; const gradeValue = trim(source.gradeName); const classValue = trim(source.className);
    const gradeCandidates = input.placementMode === "class_scoped" ? (fixedGrade ? [fixedGrade] : []) : resolveGrade(gradeValue, gradeRecords);
    let resolvedGrade = gradeCandidates.length === 1 ? gradeCandidates[0] : null;
    if (input.placementMode === "class_scoped" && gradeValue && fixedGrade && gradeCandidates.length === 0) rowIssues.push(issue("fixed_class_conflict", `This row says ${gradeValue}, but the selected class is ${fixedGrade.name}.`, "gradeName", gradeValue));
    if (input.placementMode === "school_wide" && gradeValue && gradeCandidates.length === 0) rowIssues.push(issue("grade_not_found", `No active school grade matched “${gradeValue}”.`, "gradeName", gradeValue));
    if (input.placementMode === "school_wide" && gradeValue && gradeCandidates.length > 1) rowIssues.push(issue("grade_ambiguous", `Several active grades matched “${gradeValue}”.`, "gradeName", gradeValue));
    if (gradeValue) { const lookup = normalize(gradeValue); const affectedRows = gradeResolutions.get(lookup)?.affectedRows || []; gradeResolutions.set(lookup, { sourceValue: gradeValue, gradeId: resolvedGrade ? id(resolvedGrade._id) : null, resolvedLabel: resolvedGrade?.name || null, candidateOptions: gradeCandidates.map((item) => candidate(item._id, item.name, item)), source: gradeCandidates.length === 1 ? "alias" : "inferred", status: gradeCandidates.length === 1 ? "resolved" : gradeCandidates.length ? "needs_review" : "blocked", affectedRows: [...affectedRows, source.sourceRowNumber] }); }
    let resolvedClass: ClassRec | null = null;
    if (input.placementMode === "class_scoped") resolvedClass = fixedClass;
    else if (classValue && resolvedGrade) { const matches = classMatches(classValue, resolvedGrade, classRecords); resolvedClass = matches.length === 1 ? matches[0] : null; const lookup = `${id(resolvedGrade._id)}::${normalize(classValue)}`; const affectedRows = classResolutions.get(lookup)?.affectedRows || []; classResolutions.set(lookup, { sourceValue: classValue, gradeId: id(resolvedGrade._id), classGroupId: matches.length === 1 ? id(matches[0]._id) : null, resolvedLabel: matches.length === 1 ? matches[0].name : null, candidateOptions: matches.map((item) => candidate(item._id, item.name, resolvedGrade)), source: matches.length === 1 ? "alias" : "inferred", status: matches.length === 1 ? "resolved" : matches.length ? "needs_review" : "blocked", affectedRows: [...affectedRows, source.sourceRowNumber] }); if (matches.length > 1) rowIssues.push(issue("class_ambiguous", `Several active classes matched “${classValue}”.`, "className", classValue)); if (!matches.length) rowIssues.push(issue("class_not_found", `No active class matched “${classValue}” in ${resolvedGrade.name}.`, "className", classValue)); }
    if (input.placementMode === "school_wide" && !gradeValue) rowIssues.push(issue("grade_required", "Grade is required for school-wide imports.", "gradeName"));
    if (input.placementMode === "school_wide" && !classValue) rowIssues.push(issue("class_required", "Class group is required for school-wide imports.", "className"));
    if (!source.firstName || !source.lastName) rowIssues.push(issue("missing_required", "First name and last name are required.", "name"));
    const sexValue = sex(source.rawSex); if (sexValue.status === "needs_review") rowIssues.push(issue("sex_review", `Sex “${source.rawSex}” needs review.`, "sex", source.rawSex || ""));
    const statusValue = status(source.rawStatus); if (statusValue.status === "needs_review") rowIssues.push(issue("status_review", `Status “${source.rawStatus}” needs review.`, "status", source.rawStatus || ""));
    const dob = dateInfo(source.dateOfBirth, dateFormat); const enrolled = dateInfo(source.enrolledAt, dateFormat);
    for (const [field, info, raw] of [["dateOfBirth", dob, source.dateOfBirth], ["enrolledAt", enrolled, source.enrolledAt] ] as const) { if (raw) { dateExamples.push({ field, rawValue: raw, dayMonthYear: iso(parseStudentImportDate(raw, "dmy")), monthDayYear: iso(parseStudentImportDate(raw, "mdy")), status: info.status === "ambiguous" ? "ambiguous" : info.status === "invalid" ? "invalid" : "resolved" }); } if (info.status === "invalid") rowIssues.push(issue("date_invalid", `${field === "dateOfBirth" ? "Date of birth" : "Enrolment date"} is invalid.`, field, raw || "")); if (info.status === "ambiguous") rowIssues.push(issue("date_ambiguous", `${field === "dateOfBirth" ? "Date of birth" : "Enrolment date"} needs a file date-format choice.`, field, raw || "")); }
    const today = new Date(); if (dob.date && dob.date > today) rowIssues.push(issue("dob_future", "Date of birth cannot be in the future.", "dateOfBirth")); if (dob.date && enrolled.date && dob.date >= enrolled.date) rowIssues.push(issue("dob_after_enrolled", "Date of birth must be before enrolment date.", "dateOfBirth"));
    const admission = trim(source.admissionNo); if (admission) { const list = admissions.get(admission.toLowerCase()) || []; admissions.set(admission.toLowerCase(), [...list, source.sourceRowNumber]); const found = existing.find((item) => trim(item.admissionNo).toLowerCase() === admission.toLowerCase()); if (found) warnings.push(issue("existing_admission", `Admission number ${admission} already exists; this row will be skipped.`, "admissionNo", admission, [source.sourceRowNumber])); }
    const nameKey = normalize(`${source.firstName} ${source.middleName || ""} ${source.lastName}`); if (dob.date) { const dobIso = iso(dob.date); const list = names.get(`${nameKey}:${dobIso}`) || []; names.set(`${nameKey}:${dobIso}`, [...list, source.sourceRowNumber]); if (existing.some((item) => normalize(`${item.firstName} ${item.middleName || ""} ${item.lastName}`) === nameKey && item.dateOfBirth && new Date(item.dateOfBirth).toISOString().slice(0,10) === dobIso)) warnings.push(issue("possible_duplicate", "A student with the same name and date of birth may already exist; review before confirming.", "name", undefined, [source.sourceRowNumber])); }
    const existingStudent = admission ? existing.find((item) => trim(item.admissionNo).toLowerCase() === admission.toLowerCase()) : null;
    const resolutionStatus = existingStudent ? "resolved" : rowIssues.some((item) => item.code === "missing_required" || item.code.endsWith("not_found") || item.code.includes("invalid") || item.code.includes("future") || item.code.includes("after") || item.code === "grade_required" || item.code === "class_required") ? "blocked" : rowIssues.length ? "needs_review" : "resolved";
    rows.push({ sourceRowNumber: source.sourceRowNumber, sourceSheetName: source.sourceSheetName, sourceValues: source.sourceValues, firstName: source.firstName, middleName: source.middleName || null, lastName: source.lastName, fullName: source.fullName || null, admissionNo: admission || null, sex: sexValue.value, dateOfBirth: iso(dob.date), enrolledAt: iso(enrolled.date), gradeName: resolvedGrade?.name || gradeValue || null, gradeId: resolvedGrade ? id(resolvedGrade._id) : null, className: resolvedClass?.name || classValue || null, classGroupId: resolvedClass ? id(resolvedClass._id) : null, status: statusValue.value, rawStatus: source.rawStatus || null, rawSex: source.rawSex || null, gesIndexNumber: trim(source.gesIndexNumber) || null, gesSchoolCode: trim(source.gesSchoolCode) || null, resolutionStatus, rowState: existingStudent ? "existing" : resolutionStatus === "resolved" ? "ready" : "pending", issues: existingStudent ? [issue("existing", "Already exists; skipped without overwriting.", "admissionNo", admission || "")] : rowIssues });
  }
  for (const [value, affectedRows] of admissions) if (affectedRows.length > 1) { const duplicateIssue = issue("duplicate_in_file", `Admission number ${value} appears more than once in this file.`, "admissionNo", value, affectedRows); errors.push(duplicateIssue); for (const row of rows.filter((item) => affectedRows.includes(item.sourceRowNumber))) { row.issues.push(duplicateIssue); row.resolutionStatus = "blocked"; row.rowState = "pending"; } }
  if (input.placementMode === "class_scoped" && fixedClass) { const affected = rows.filter((row) => row.rowState === "ready" || row.rowState === "existing"); const conflict = rows.filter((row) => row.issues.some((item) => item.code === "fixed_class_conflict")); const targetResolution: IStudentImportClassResolution = { sourceValue: fixedClass.name, gradeId: id(fixedClass.gradeId), classGroupId: id(fixedClass._id), resolvedLabel: fixedClass.name, candidateOptions: [candidate(fixedClass._id, fixedClass.name, fixedGrade)], source: "admin", status: conflict.length && input.classConflictPolicy !== "use_target" ? "needs_review" : "resolved", affectedRows: affected.map((row) => row.sourceRowNumber), currentCount: await Student.countDocuments({ schoolId: input.schoolId, classGroupId: fixedClass._id }), capacity: fixedClass.capacity ?? null, projectedCount: await Student.countDocuments({ schoolId: input.schoolId, classGroupId: fixedClass._id }) + affected.length, note: conflict.length ? "Rows with conflicting class/grade values require an explicit use-target decision." : null }; classResolutions.set(`fixed:${id(fixedClass._id)}`, targetResolution); }
  for (const resolution of classResolutions.values()) { if (resolution.classGroupId && resolution.capacity == null) resolution.capacity = classRecords.find((item) => id(item._id) === resolution.classGroupId)?.capacity ?? null; if (resolution.classGroupId && resolution.capacity != null) { const current = await Student.countDocuments({ schoolId: input.schoolId, classGroupId: new mongoose.Types.ObjectId(resolution.classGroupId) }); const projected = current + rows.filter((row) => row.classGroupId === resolution.classGroupId && row.rowState === "ready").length; resolution.currentCount = current; resolution.projectedCount = projected; if (projected > resolution.capacity) { const capacityIssue = issue("capacity_blocked", `${resolution.resolvedLabel || "Class"} would exceed its capacity of ${resolution.capacity}.`, "className", resolution.resolvedLabel || "", resolution.affectedRows); errors.push(capacityIssue); for (const row of rows.filter((item) => item.classGroupId === resolution.classGroupId && item.rowState === "ready")) { row.issues.push(capacityIssue); row.resolutionStatus = "blocked"; row.rowState = "pending"; } } } }
  const unresolvedGrades = [...gradeResolutions.values()].filter((item) => item.status !== "resolved").map((item) => item.sourceValue); const unresolvedClasses = [...classResolutions.values()].filter((item) => item.status !== "resolved").map((item) => item.sourceValue); let leoUnavailable = false; let leoUsed = false;
  if (unresolvedGrades.length || unresolvedClasses.length) { const leo = await suggestStudentImportSemantics({ schoolId: input.schoolId, unresolvedGrades, unresolvedClasses, sexValues: [...new Set(rows.map((row) => row.rawSex).filter(Boolean) as string[])], statusValues: [...new Set(rows.map((row) => row.rawStatus).filter(Boolean) as string[])], gradeCatalog: gradeRecords.map((item) => item.name), classCatalog: classRecords.map((item) => ({ gradeName: gradeRecords.find((grade) => id(grade._id) === id(item.gradeId))?.name || "", className: item.name })) }); if (leo.ok) leoUsed = leo.suggestions.gradeSuggestions.length > 0 || leo.suggestions.classSuggestions.length > 0; else { leoUnavailable = true; warnings.push(issue("leo_unavailable", `Leo assistance was unavailable: ${leo.reason}`)); } }
  const readyRows = rows.filter((row) => row.rowState === "ready").length; const existingRows = rows.filter((row) => row.rowState === "existing").length; const summary: IStudentImportAnalysisSummary = { totalRows: rows.length, readyRows, needsReviewRows: rows.filter((row) => row.resolutionStatus === "needs_review").length, blockedRows: rows.filter((row) => row.resolutionStatus === "blocked").length, existingRows, mappedColumns: parsed.columnMappings.filter((item) => item.canonicalField).length, resolvedGradeAliases: [...gradeResolutions.values()].filter((item) => item.status === "resolved").length, resolvedClassAliases: [...classResolutions.values()].filter((item) => item.status === "resolved").length, resolvedDateValues: dateExamples.filter((item) => item.status === "resolved").length, possibleDuplicates: warnings.filter((item) => item.code === "possible_duplicate").length, capacityBlockedRows: rows.filter((row) => row.issues.some((item) => item.code === "capacity_blocked")).length, currentStudentCount: existing.length, projectedNewStudents: readyRows, studentLimit: null, studentLimitAvailable: null, leoUsed, leoUnavailable };
  return { selectedSheetName: parsed.selectedSheetName, availableSheets: parsed.sheets.map(({ name, score, rowCount, signals }) => ({ name, score, rowCount, signals })), sheetSelectionRequired: parsed.sheetSelectionRequired, columnMappings: parsed.columnMappings, unusedColumns: parsed.unusedColumns, parsedRows: rows, gradeResolutions: [...gradeResolutions.values()], classResolutions: [...classResolutions.values()], dateExamples, analysisSummary: summary, analysisWarnings: warnings, analysisErrors: errors };
}
