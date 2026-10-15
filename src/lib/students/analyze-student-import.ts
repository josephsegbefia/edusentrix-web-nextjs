import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import type {
  IStudentImportAnalysisSummary,
  IStudentImportClassResolution,
  IStudentImportGradeResolution,
  IStudentImportIssue,
  IStudentImportJob,
  IStudentImportParsedRow,
} from "@/models/StudentImportJob";
import { parseStudentImportDate, parseStudentImportWorkbook } from "@/lib/students/student-import-parse";
import { suggestStudentImportSemantics } from "@/lib/students/student-import-leo";
import type { ImportLeoMetadata } from "@/lib/leo/import-completion";

type GradeRec = { _id: mongoose.Types.ObjectId; name: string; code?: string | null; stage?: string };
type ClassRec = { _id: mongoose.Types.ObjectId; name: string; gradeId: mongoose.Types.ObjectId; capacity?: number | null };
type AnalysisResult = Pick<IStudentImportJob, "selectedSheetName" | "availableSheets" | "sheetSelectionRequired" | "columnMappings" | "unusedColumns" | "parsedRows" | "gradeResolutions" | "classResolutions" | "dateExamples" | "analysisSummary" | "analysisWarnings" | "analysisErrors"> & { leoAnalysis?: ImportLeoMetadata | null };

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const trim = (value: unknown) => String(value ?? "").trim();
const id = (value: unknown) => String(value || "");
const unique = <T,>(values: T[], key: (value: T) => string) => [...new Map(values.map((value) => [key(value), value])).values()];
const issue = (code: string, message: string, field?: string, value?: string, affectedRows: number[] = []): IStudentImportIssue => ({ code, message, field: field || null, value: value || null, affectedRows });

const numberWords: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };

function gradeAliases(grade: GradeRec) {
  const aliases = new Set([grade.name, grade.code || ""].filter(Boolean).map(normalize));
  const match = grade.name.match(/(creche|nursery|kg|kindergarten|primary|basic|grade|jhs|junior\s*high|juniorhigh|shs|senior\s*high|seniorhigh|form)\s*[- ]?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (!match) return aliases;

  const number = Number(numberWords[match[2].toLowerCase()] || match[2]);
  const family = match[1].toLowerCase().replace(/\s+/g, "");
  if (["primary", "basic", "grade"].includes(family)) {
    for (const prefix of ["primary", "basic", "grade"]) {
      aliases.add(normalize(`${prefix}${number}`));
      aliases.add(normalize(`${prefix} ${number}`));
    }
  }
  if (["jhs", "juniorhigh"].includes(family)) {
    for (const prefix of ["jhs", "juniorhigh", "form"]) aliases.add(normalize(`${prefix}${number}`));
    aliases.add(normalize(`basic${number + 6}`));
  }
  if (["shs", "seniorhigh"].includes(family)) {
    for (const prefix of ["shs", "seniorhigh", "form"]) aliases.add(normalize(`${prefix}${number}`));
  }
  return aliases;
}

function resolveGrade(value: string, grades: GradeRec[]) {
  const normalized = normalize(value);
  if (!normalized) return [] as GradeRec[];
  return grades.filter((grade) => gradeAliases(grade).has(normalized));
}

function gradesFromCombinedClass(value: string, grades: GradeRec[]) {
  const normalized = normalize(value);
  if (!normalized) return [] as GradeRec[];
  return grades.filter((grade) => [...gradeAliases(grade)].some((alias) => normalized.startsWith(alias) && normalized.length > alias.length));
}

function classSuffix(className: string, grade: GradeRec) {
  const normalizedClass = normalize(className);
  const aliases = [...gradeAliases(grade)].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (normalizedClass.startsWith(alias) && normalizedClass.length > alias.length) return normalizedClass.slice(alias.length);
  }
  return "";
}

function displayClassLabel(gradeName: string, className: string) {
  const grade = trim(gradeName).replace(/\s+/g, " ");
  const group = trim(className).replace(/\s+/g, " ");
  if (!grade) return group;
  if (!group) return grade;
  if (group.toLowerCase() === grade.toLowerCase() || group.toLowerCase().startsWith(`${grade.toLowerCase()} `)) return group;
  return `${grade} ${group}`;
}

function classMatches(value: string, grade: GradeRec | null, classes: ClassRec[], explicitGradeValue = "") {
  const normalized = normalize(value);
  if (!normalized) return [] as ClassRec[];
  const candidates = new Set([normalized]);
  const sourceGrade = normalize(explicitGradeValue);
  if (sourceGrade && normalized.startsWith(sourceGrade) && normalized.length > sourceGrade.length) candidates.add(normalized.slice(sourceGrade.length));
  if (grade) {
    const suffix = classSuffix(value, grade);
    if (suffix) candidates.add(suffix);
  }

  return classes.filter((item) => {
    if (grade && id(item.gradeId) !== id(grade._id)) return false;
    const names = new Set([normalize(item.name), normalize(`${grade?.name || ""} ${item.name}`), normalize(displayClassLabel(grade?.name || "", item.name))]);
    if (grade) {
      const storedSuffix = classSuffix(item.name, grade);
      if (storedSuffix) names.add(storedSuffix);
    }
    return [...candidates].some((candidate) => names.has(candidate));
  });
}

function allClassMatches(value: string, grades: GradeRec[], classes: ClassRec[]) {
  return unique(grades.flatMap((grade) => classMatches(value, grade, classes)), (item) => id(item._id));
}

function candidate(idValue: unknown, label: string, grade?: GradeRec | null) {
  return { id: id(idValue), label, gradeId: grade ? id(grade._id) : null, gradeName: grade?.name || null };
}

function dateInfo(raw: string | null | undefined, format: "auto" | "dmy" | "mdy") {
  const value = trim(raw);
  if (!value) return { date: null, status: "resolved" as const, ambiguous: false };
  const dmy = parseStudentImportDate(value, "dmy");
  const mdy = parseStudentImportDate(value, "mdy");
  if (!dmy && !mdy) return { date: null, status: "invalid" as const, ambiguous: false };
  if (format === "dmy") return { date: dmy, status: dmy ? "resolved" as const : "invalid" as const, ambiguous: false };
  if (format === "mdy") return { date: mdy, status: mdy ? "resolved" as const : "invalid" as const, ambiguous: false };
  if (dmy && mdy && dmy.getTime() !== mdy.getTime()) return { date: null, status: "ambiguous" as const, ambiguous: true };
  return { date: dmy || mdy, status: "resolved" as const, ambiguous: false };
}

function iso(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export async function analyzeStudentImport(input: {
  schoolId: mongoose.Types.ObjectId;
  fileName: string;
  fileBytes: Buffer;
  selectedSheetName?: string | null;
  dateFormat?: "auto" | "dmy" | "mdy";
  placementMode: "school_wide" | "class_scoped";
  fixedGradeId?: mongoose.Types.ObjectId | null;
  fixedClassGroupId?: mongoose.Types.ObjectId | null;
  classConflictPolicy?: "review" | "use_target";
}): Promise<AnalysisResult> {
  const parsed = parseStudentImportWorkbook(input.fileBytes, input.fileName, input.selectedSheetName);
  const [grades, classes, existing] = await Promise.all([
    Grade.find({ schoolId: input.schoolId, isActive: true }).select("_id name code stage").lean(),
    ClassGroup.find({ schoolId: input.schoolId, isActive: true }).select("_id name gradeId capacity").lean(),
    Student.find({ schoolId: input.schoolId }).select("_id firstName middleName lastName dateOfBirth").lean(),
  ]);
  const gradeRecords = grades as GradeRec[];
  const classRecords = classes as ClassRec[];
  const fixedClass = input.fixedClassGroupId ? classRecords.find((item) => id(item._id) === id(input.fixedClassGroupId)) || null : null;
  const fixedGrade = input.fixedGradeId
    ? gradeRecords.find((item) => id(item._id) === id(input.fixedGradeId)) || null
    : fixedClass ? gradeRecords.find((item) => id(item._id) === id(fixedClass.gradeId)) || null : null;
  if (input.placementMode === "class_scoped" && (!fixedClass || !fixedGrade)) throw new Error("The selected target class is no longer available in this school.");

  const dateFormat = input.dateFormat || "auto";
  const gradeResolutions = new Map<string, IStudentImportGradeResolution>();
  const classResolutions = new Map<string, IStudentImportClassResolution>();
  const rows: IStudentImportParsedRow[] = [];
  const warnings: IStudentImportIssue[] = [];
  const errors: IStudentImportIssue[] = [];
  const dateExamples: IStudentImportJob["dateExamples"] = [];

  const gradeInputs = unique(parsed.rows.map((row) => trim(row.gradeName)).filter(Boolean), (value) => normalize(value));
  const classInputs = unique(parsed.rows.map((row) => {
    const grade = trim(row.gradeName);
    const className = trim(row.className);
    return [grade, className].filter(Boolean).join(" :: ");
  }).filter(Boolean), (value) => normalize(value));
  const leo = await suggestStudentImportSemantics({
    schoolId: input.schoolId,
    unresolvedGrades: gradeInputs,
    unresolvedClasses: classInputs,
    sexValues: [],
    statusValues: [],
    gradeCatalog: gradeRecords.map((item) => item.name),
    classCatalog: classRecords.map((item) => ({ gradeName: gradeRecords.find((grade) => id(grade._id) === id(item.gradeId))?.name || "", className: item.name })),
  });
  const leoClassSuggestions = leo.ok ? leo.suggestions.classSuggestions : [];
  const leoGradeSuggestions = leo.ok ? leo.suggestions.gradeSuggestions : [];
  const leoByClassValue = new Map(leoClassSuggestions.map((suggestion) => [normalize(suggestion.sourceValue), suggestion]));
  const leoByGradeValue = new Map(leoGradeSuggestions.map((suggestion) => [normalize(suggestion.sourceValue), suggestion]));

  for (const source of parsed.rows) {
    const rowIssues: IStudentImportIssue[] = [];
    const rawGradeValue = trim(source.gradeName);
    const rawClassValue = trim(source.className);
    const classSourceValue = [rawGradeValue, rawClassValue].filter(Boolean).join(" :: ");
    const classSuggestion = leoByClassValue.get(normalize(classSourceValue)) || leoByClassValue.get(normalize(rawClassValue)) || leoByClassValue.get(normalize(rawGradeValue));
    const gradeSuggestion = leoByGradeValue.get(normalize(rawGradeValue));
    const suggestedGradeValue = trim(classSuggestion?.suggestedGradeName || gradeSuggestion?.suggestedGradeName);
    const suggestedClassValue = trim(classSuggestion?.suggestedClassName);

    let gradeCandidates: GradeRec[] = [];
    let resolvedGrade: GradeRec | null = null;
    let resolvedClass: ClassRec | null = null;
    let classCandidates: ClassRec[] = [];
    let gradeSource: "alias" | "leo" | "inferred" = "inferred";
    let classSource: "alias" | "leo" | "inferred" = "inferred";

    if (input.placementMode === "class_scoped") {
      resolvedGrade = fixedGrade;
      resolvedClass = fixedClass;
    } else {
      gradeCandidates = resolveGrade(rawGradeValue, gradeRecords);
      if (!gradeCandidates.length && rawClassValue) gradeCandidates = gradesFromCombinedClass(rawClassValue, gradeRecords);
      if (!gradeCandidates.length && rawGradeValue) gradeCandidates = gradesFromCombinedClass(rawGradeValue, gradeRecords);
      if (!gradeCandidates.length && suggestedGradeValue) gradeCandidates = resolveGrade(suggestedGradeValue, gradeRecords);
      resolvedGrade = gradeCandidates.length === 1 ? gradeCandidates[0] : null;
      if (resolvedGrade) gradeSource = suggestedGradeValue && !resolveGrade(rawGradeValue, gradeRecords).length ? "leo" : "alias";

      const classLookupValue = suggestedClassValue || rawClassValue || rawGradeValue;
      if (resolvedGrade) {
        classCandidates = classMatches(classLookupValue, resolvedGrade, classRecords, rawGradeValue);
      } else if (classLookupValue) {
        classCandidates = allClassMatches(classLookupValue, gradeRecords, classRecords);
        if (classCandidates.length === 1) {
          resolvedClass = classCandidates[0];
          resolvedGrade = gradeRecords.find((grade) => id(grade._id) === id(resolvedClass?.gradeId)) || null;
          gradeCandidates = resolvedGrade ? [resolvedGrade] : [];
        }
      }
      if (!resolvedClass && classCandidates.length === 1) resolvedClass = classCandidates[0];
      if (resolvedClass) classSource = suggestedClassValue ? "leo" : "alias";
    }

    const gradeValueForReview = rawGradeValue || suggestedGradeValue || rawClassValue;
    if (gradeValueForReview) {
      const lookup = normalize(gradeValueForReview);
      const previous = gradeResolutions.get(lookup);
      gradeResolutions.set(lookup, {
        sourceValue: gradeValueForReview,
        gradeId: resolvedGrade ? id(resolvedGrade._id) : null,
        resolvedLabel: resolvedGrade?.name || null,
        candidateOptions: gradeCandidates.map((item) => ({ id: id(item._id), label: item.name, gradeId: id(item._id), gradeName: item.name })),
        source: gradeSource,
        status: resolvedGrade ? "resolved" : gradeCandidates.length ? "needs_review" : "blocked",
        affectedRows: [...(previous?.affectedRows || []), source.sourceRowNumber],
      });
    }

    const classValueForReview = rawClassValue || rawGradeValue;
    if (classValueForReview) {
      const lookup = `${id(resolvedGrade?._id)}::${normalize(classValueForReview)}`;
      const previous = classResolutions.get(lookup);
      classResolutions.set(lookup, {
        sourceValue: classValueForReview,
        gradeId: resolvedGrade ? id(resolvedGrade._id) : null,
        classGroupId: resolvedClass ? id(resolvedClass._id) : null,
        resolvedLabel: resolvedClass?.name || null,
        candidateOptions: classCandidates.map((item) => {
          const candidateGrade = gradeRecords.find((grade) => id(grade._id) === id(item.gradeId));
          return { id: id(item._id), label: displayClassLabel(candidateGrade?.name || "", item.name), gradeId: id(item.gradeId), gradeName: candidateGrade?.name || null };
        }),
        source: classSource,
        status: resolvedClass ? "resolved" : classCandidates.length ? "needs_review" : "blocked",
        affectedRows: [...(previous?.affectedRows || []), source.sourceRowNumber],
      });
    }

    if (input.placementMode === "school_wide") {
      if (!resolvedGrade) {
        rowIssues.push(issue(gradeCandidates.length ? "grade_ambiguous" : "grade_not_found", gradeCandidates.length ? `Several school grades matched “${gradeValueForReview || rawClassValue}”.` : `No active school grade matched “${gradeValueForReview || "the supplied class group"}”.`, "gradeName", gradeValueForReview));
      }
      if (!classValueForReview) rowIssues.push(issue("class_required", "Class group is required for school-wide imports.", "className"));
      else if (!resolvedClass) rowIssues.push(issue(classCandidates.length ? "class_ambiguous" : "class_not_found", classCandidates.length ? `Several active class groups matched “${classValueForReview}”.` : `No active class group matched “${classValueForReview}”.`, "className", classValueForReview));
    } else if (rawGradeValue && fixedGrade && !resolveGrade(rawGradeValue, [fixedGrade]).length && !classMatches(rawGradeValue, fixedGrade, classRecords).length) {
      rowIssues.push(issue("fixed_class_conflict", `This row does not match the selected class ${fixedClass?.name || ""}.`, "className", rawClassValue || rawGradeValue));
    }

    if (!source.firstName || !source.lastName) rowIssues.push(issue("missing_required", "First name and last name are required.", "name"));

    const dob = dateInfo(source.dateOfBirth, dateFormat);
    if (source.dateOfBirth) {
      dateExamples.push({ field: "dateOfBirth", rawValue: source.dateOfBirth, dayMonthYear: iso(parseStudentImportDate(source.dateOfBirth, "dmy")), monthDayYear: iso(parseStudentImportDate(source.dateOfBirth, "mdy")), status: dob.status === "ambiguous" ? "ambiguous" : dob.status === "invalid" ? "invalid" : "resolved" });
    }
    if (dob.status === "invalid") rowIssues.push(issue("date_invalid", "Date of birth is invalid.", "dateOfBirth", source.dateOfBirth || ""));
    if (dob.status === "ambiguous") rowIssues.push(issue("date_ambiguous", "Date of birth needs a day/month/year or month/day/year choice.", "dateOfBirth", source.dateOfBirth || ""));
    if (dob.date && dob.date > new Date()) rowIssues.push(issue("dob_future", "Date of birth cannot be in the future.", "dateOfBirth"));

    const nameKey = normalize(`${source.firstName} ${source.lastName}`);
    if (dob.date && existing.some((item) => normalize(`${item.firstName} ${item.middleName || ""} ${item.lastName}`) === nameKey && item.dateOfBirth && new Date(item.dateOfBirth).toISOString().slice(0, 10) === iso(dob.date))) {
      warnings.push(issue("possible_duplicate", "A student with the same name and date of birth may already exist; review before confirming.", "name", undefined, [source.sourceRowNumber]));
      rowIssues.push(issue("possible_duplicate", "A student with the same name and date of birth may already exist.", "name"));
    }

    const blockingCodes = new Set(["missing_required", "grade_not_found", "grade_ambiguous", "class_required", "class_not_found", "class_ambiguous", "date_invalid", "date_ambiguous", "dob_future", "fixed_class_conflict"]);
    const resolutionStatus = rowIssues.some((item) => blockingCodes.has(item.code)) ? "blocked" : rowIssues.length ? "needs_review" : "resolved";
    rows.push({
      sourceRowNumber: source.sourceRowNumber,
      sourceSheetName: source.sourceSheetName,
      sourceValues: source.sourceValues,
      firstName: source.firstName,
      middleName: null,
      lastName: source.lastName,
      fullName: source.fullName || null,
      admissionNo: null,
      sex: null,
      dateOfBirth: iso(dob.date),
      enrolledAt: null,
      gradeName: resolvedGrade?.name || gradeValueForReview || null,
      gradeId: resolvedGrade ? id(resolvedGrade._id) : null,
      className: resolvedClass?.name || classValueForReview || null,
      classGroupId: resolvedClass ? id(resolvedClass._id) : null,
      status: "active",
      rawStatus: null,
      rawSex: null,
      gesIndexNumber: null,
      gesSchoolCode: null,
      resolutionStatus,
      rowState: resolutionStatus === "resolved" ? "ready" : "pending",
      issues: rowIssues,
    });
  }

  const duplicateNames = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.dateOfBirth) continue;
    const key = `${normalize(`${row.firstName} ${row.lastName}`)}:${row.dateOfBirth}`;
    duplicateNames.set(key, [...(duplicateNames.get(key) || []), row.sourceRowNumber]);
  }
  for (const [value, affectedRows] of duplicateNames) {
    if (affectedRows.length < 2) continue;
    const duplicateIssue = issue("duplicate_in_file", "The same student name and date of birth appear more than once in this file.", "name", value, affectedRows);
    errors.push(duplicateIssue);
    for (const row of rows.filter((item) => affectedRows.includes(item.sourceRowNumber))) {
      row.issues.push(duplicateIssue);
      row.resolutionStatus = "blocked";
      row.rowState = "pending";
    }
  }

  if (input.placementMode === "class_scoped" && fixedClass && fixedGrade) {
    const affected = rows.filter((row) => row.rowState === "ready");
    const conflict = rows.filter((row) => row.issues.some((item) => item.code === "fixed_class_conflict"));
    classResolutions.set(`fixed:${id(fixedClass._id)}`, {
      sourceValue: fixedClass.name,
      gradeId: id(fixedClass.gradeId),
      classGroupId: id(fixedClass._id),
      resolvedLabel: fixedClass.name,
      candidateOptions: [candidate(fixedClass._id, fixedClass.name, fixedGrade)],
      source: "admin",
      status: conflict.length && input.classConflictPolicy !== "use_target" ? "needs_review" : "resolved",
      affectedRows: affected.map((row) => row.sourceRowNumber),
      currentCount: await Student.countDocuments({ schoolId: input.schoolId, classGroupId: fixedClass._id }),
      capacity: fixedClass.capacity ?? null,
      projectedCount: (await Student.countDocuments({ schoolId: input.schoolId, classGroupId: fixedClass._id })) + affected.length,
      note: conflict.length ? "Rows with conflicting class values require an explicit use-target decision." : null,
    });
  }

  for (const resolution of classResolutions.values()) {
    if (!resolution.classGroupId || resolution.capacity == null) continue;
    const current = await Student.countDocuments({ schoolId: input.schoolId, classGroupId: new mongoose.Types.ObjectId(resolution.classGroupId) });
    const projected = current + rows.filter((row) => row.classGroupId === resolution.classGroupId && row.rowState === "ready").length;
    resolution.currentCount = current;
    resolution.projectedCount = projected;
    if (projected > resolution.capacity) {
      const capacityIssue = issue("capacity_blocked", `${resolution.resolvedLabel || "Class"} would exceed its capacity of ${resolution.capacity}.`, "className", resolution.resolvedLabel || "", resolution.affectedRows);
      errors.push(capacityIssue);
      for (const row of rows.filter((item) => item.classGroupId === resolution.classGroupId && item.rowState === "ready")) {
        row.issues.push(capacityIssue);
        row.resolutionStatus = "blocked";
        row.rowState = "pending";
      }
    }
  }

  const leoUnavailable = !leo.ok;
  const warningsWithLeo = leoUnavailable && classInputs.length ? [...warnings, issue("leo_unavailable", `Leo assistance was unavailable: ${leo.reason}`)] : warnings;
  const readyRows = rows.filter((row) => row.rowState === "ready").length;
  const summary: IStudentImportAnalysisSummary = {
    totalRows: rows.length,
    readyRows,
    needsReviewRows: rows.filter((row) => row.resolutionStatus === "needs_review").length,
    blockedRows: rows.filter((row) => row.resolutionStatus === "blocked").length,
    existingRows: 0,
    mappedColumns: parsed.columnMappings.filter((item) => item.canonicalField && ["firstName", "middleName", "lastName", "fullName", "dateOfBirth", "gradeName", "className"].includes(item.canonicalField)).length,
    resolvedGradeAliases: [...gradeResolutions.values()].filter((item) => item.status === "resolved").length,
    resolvedClassAliases: [...classResolutions.values()].filter((item) => item.status === "resolved").length,
    resolvedDateValues: dateExamples.filter((item) => item.status === "resolved").length,
    possibleDuplicates: warningsWithLeo.filter((item) => item.code === "possible_duplicate").length,
    capacityBlockedRows: rows.filter((row) => row.issues.some((item) => item.code === "capacity_blocked")).length,
    currentStudentCount: existing.length,
    projectedNewStudents: readyRows,
    studentLimit: null,
    studentLimitAvailable: null,
    leoUsed: leo.ok,
    leoUnavailable,
  };

  return {
    selectedSheetName: parsed.selectedSheetName,
    availableSheets: parsed.sheets.map(({ name, score, rowCount, signals }) => ({ name, score, rowCount, signals })),
    sheetSelectionRequired: parsed.sheetSelectionRequired,
    columnMappings: parsed.columnMappings,
    unusedColumns: parsed.unusedColumns,
    parsedRows: rows,
    gradeResolutions: [...gradeResolutions.values()],
    classResolutions: [...classResolutions.values()],
    dateExamples,
    analysisSummary: summary,
    analysisWarnings: warningsWithLeo,
    analysisErrors: errors,
    leoAnalysis: leo.metadata || null,
  };
}
