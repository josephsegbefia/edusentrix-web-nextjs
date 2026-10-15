import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import type {
  ITeacherImportAnalysisSummary,
  ITeacherImportClassResolution,
  ITeacherImportColumnMapping,
  ITeacherImportIssue,
  ITeacherImportJob,
  ITeacherImportParsedRow,
  ITeacherImportSubjectResolution,
  TeacherImportMappingSource,
  TeacherImportResolutionStatus,
} from "@/models/TeacherImportJob";
import {
  parseTeacherImportWorkbook,
  type TeacherImportParseOptions,
  type TeacherImportRow,
} from "@/lib/teachers/parse-teacher-import";
import {
  suggestTeacherImportHeaders,
  suggestTeacherImportSemantics,
} from "@/lib/teachers/teacher-import-leo";
import type { ImportLeoMetadata } from "@/lib/leo/import-completion";
import {
  assignmentFromResolution,
  classAliases as understandingClassAliases,
  gradeBandForGrade,
  normalizeTeacherUnderstanding,
  parseTeacherAssignmentText,
  provenance,
  resolveClassLabel,
  resolveGradeLabel,
  resolveSubjectForContext,
  type TeacherContext,
  type TeacherUnderstandingClass,
  type TeacherUnderstandingGrade,
  type TeacherUnderstandingOffering,
} from "@/lib/teachers/teacher-understanding";
import type { ImportIssueV2, ImportRowReference } from "@/lib/import-intelligence/types";
import { createImportIssue } from "@/lib/import-intelligence/issues";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";
import { attentionIssueForSignal, detectTeacherAttentionSignals } from "@/lib/teachers/teacher-attention-review";

type IdLike = mongoose.Types.ObjectId | string;

type GradeRecord = TeacherUnderstandingGrade & { _id: IdLike; name: string };
type ClassRecord = {
  _id: IdLike;
  name: string;
  gradeId: IdLike;
  homeroomTeacherId?: IdLike | null;
  subjectOfferingIds?: IdLike[];
};
type OfferingRecord = {
  _id: IdLike;
  subjectId: IdLike;
  displayName: string;
  shortName?: string | null;
  code?: string | null;
  subjectFamily?: string | null;
  gradeIds?: IdLike[];
  gradeBand?: string | null;
  stage?: string | null;
  isActive?: boolean;
};

export type TeacherImportAnalysisResult = Pick<ITeacherImportJob, "selectedSheetName" | "availableSheets" | "sheetSelectionRequired" | "columnMappings" | "parsedRows" | "subjectResolutions" | "classResolutions" | "analysisSummary" | "analysisWarnings" | "analysisErrors"> & { leoAnalysis?: ImportLeoMetadata | null; columnInterpretations?: ITeacherImportJob["columnInterpretations"]; analysisIssues?: ImportIssueV2[] };

type TeacherImportLeoDependencies = {
  suggestHeaders?: typeof suggestTeacherImportHeaders;
  suggestSemantics?: typeof suggestTeacherImportSemantics;
};

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function normalizeTeacherImportLookup(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function clean(value: string | null | undefined) {
  return (value || "").trim();
}

function headerSignalsForLeo(sheet: { headers: string[]; rows: Array<{ values: Record<string, string> }> } | undefined) {
  if (!sheet) return [];
  return sheet.headers.map((sourceHeader) => {
    const values = sheet.rows.map((row) => clean(row.values[sourceHeader])).filter(Boolean).slice(0, 200);
    const kinds = new Set<string>();
    for (const value of values) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) kinds.add("email-like");
      else if (/^[+\d][\d\s().-]{6,}$/.test(value)) kinds.add("phone-like");
      else if (/^\d+(?:\.\d+)?$/.test(value)) kinds.add("numeric");
      else if (/[,;|\n]/.test(value)) kinds.add("multi-value text");
      else if (/\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(value)) kinds.add("date-like");
      else if (value.split(/\s+/).length >= 2) kinds.add("multi-word text");
      else kinds.add("text");
    }
    return { sourceHeader, nonEmptyCount: values.length, valueKinds: [...kinds].sort() };
  });
}

function unique<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function teacherImportResolutionKey(sourceValue: string, gradeId?: string | null) {
  return `${normalizeTeacherImportLookup(sourceValue)}::${gradeId || "no-grade-context"}`;
}

function splitTokens(values: string[]) {
  return values.flatMap((value) => value.split(/[;,|\n]/).map((part) => part.trim()).filter(Boolean));
}

function objectIdString(value: unknown) {
  return value instanceof mongoose.Types.ObjectId ? value.toString() : String(value);
}

function toObjectId(value: string) {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function statusValue(value: string | null | undefined) {
  const normalized = normalizeTeacherImportLookup(clean(value));
  if (!normalized) return { value: "active" as const, status: "resolved" as const };
  const aliases: Record<string, "active" | "inactive" | "on_leave" | "terminated"> = {
    active: "active",
    employed: "active",
    current: "active",
    working: "active",
    inactive: "inactive",
    former: "inactive",
    onleave: "on_leave",
    leave: "on_leave",
    terminated: "terminated",
    dismissed: "terminated",
  };
  const mapped = aliases[normalized];
  return mapped
    ? { value: mapped, status: "resolved" as const }
    : { value: null as string | null, status: "needs_review" as const };
}

function offeringAliases(offering: OfferingRecord) {
  const values = [offering.displayName, offering.shortName, offering.code, offering.subjectFamily]
    .map(clean)
    .filter(Boolean);
  return unique(
    values.flatMap((value) => [
      value,
      value.replace(/\s*[-/]\s*(jhs|shs|primary|upper primary|lower primary|preschool)\s*$/i, ""),
    ]),
    normalizeTeacherImportLookup
  ).map(normalizeTeacherImportLookup).filter(Boolean);
}

function subjectFamilyForToken(token: string) {
  return normalizeTeacherImportLookup(token.replace(/\s*[-/]\s*(jhs|shs|primary|upper primary|lower primary|preschool)\s*$/i, ""));
}

function classAliases(classGroup: ClassRecord, gradeName: string) {
  const name = clean(classGroup.name);
  const grade = clean(gradeName);
  const combined = grade ? `${grade} ${name}` : name;
  return unique(
    [name, combined, combined.replace(/\s+/g, ""), name.replace(/^(.+?)([A-Z])$/i, "$1 $2")],
    normalizeTeacherImportLookup
  ).map(normalizeTeacherImportLookup).filter(Boolean);
}

function issue(
  code: string,
  message: string,
  field?: string,
  value?: string,
  affectedRows?: number[]
): ITeacherImportIssue {
  return { code, message, field: field || null, value: value || null, affectedRows: affectedRows || [] };
}

function resolutionStatus(issues: ITeacherImportIssue[]): TeacherImportResolutionStatus {
  if (issues.some((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code))) return "blocked";
  return issues.length > 0 ? "needs_review" : "resolved";
}

function rowState(status: TeacherImportResolutionStatus, existing: boolean): ITeacherImportParsedRow["rowState"] {
  if (existing) return "existing";
  if (status === "blocked" || status === "needs_review") return "pending";
  return "ready";
}

function classLabel(classGroup: ClassRecord, gradeNames: Map<string, string>) {
  return `${gradeNames.get(objectIdString(classGroup.gradeId)) || "Grade"} / ${classGroup.name}`;
}

function lookupClasses(classes: ClassRecord[], gradeNames: Map<string, string>) {
  const map = new Map<string, ClassRecord[]>();
  for (const classGroup of classes) {
    for (const alias of classAliases(classGroup, gradeNames.get(objectIdString(classGroup.gradeId)) || "")) {
      const current = map.get(alias) || [];
      map.set(alias, unique([...current, classGroup], (item) => objectIdString(item._id)));
    }
  }
  return map;
}

function findClassMatches(
  row: TeacherImportRow,
  classes: ClassRecord[],
  gradeNames: Map<string, string>,
  classMap: Map<string, ClassRecord[]>
) {
  if (clean(row.homeroomClassGroupId)) {
    const id = toObjectId(clean(row.homeroomClassGroupId));
    return id ? classes.filter((item) => objectIdString(item._id) === id.toString()) : [];
  }
  const source = clean(row.homeroomClass);
  const grade = clean(row.homeroomGrade);
  if (!source && !grade) return [];
  // A grade-qualified class must win over a generic section name: "A" can
  // exist in Primary 1 and Primary 4, while "Primary 1 A" is unambiguous.
  if (grade && source) {
    const qualified = dedupeTeacherImportClassMatches(
      [`${grade} ${source}`, `${grade}${source}`]
        .flatMap((candidate) => classMap.get(normalizeTeacherImportLookup(candidate)) || [])
    );
    if (qualified.length) return qualified;
  }
  const candidates = [source, source.replace(/\s+/g, "")].filter(Boolean);
  const matches = candidates.flatMap((candidate) => classMap.get(normalizeTeacherImportLookup(candidate)) || []);
  return dedupeTeacherImportClassMatches(matches);
}

function restrictToClassOfferings(
  offerings: OfferingRecord[],
  classGroup: ClassRecord | null
) {
  const assigned = classGroup?.subjectOfferingIds || [];
  if (!assigned.length) return offerings;
  const assignedIds = new Set(assigned.map(objectIdString));
  return offerings.filter((offering) => assignedIds.has(objectIdString(offering._id)));
}

function matchingGradeId(value: string | null | undefined, grades: GradeRecord[]) {
  const normalized = normalizeTeacherImportLookup(clean(value));
  if (!normalized) return null;
  return grades.find((grade) => normalizeTeacherImportLookup(grade.name) === normalized)?._id || null;
}

export function resolveTeacherImportSubjectToken(
  token: string,
  row: TeacherImportRow,
  classGroup: ClassRecord | null,
  offerings: OfferingRecord[]
) {
  const normalized = normalizeTeacherImportLookup(token);
  const direct = restrictToClassOfferings(
    offerings.filter((offering) => offeringAliases(offering).includes(normalized)),
    classGroup
  );
  const contextual = classGroup
    ? direct.filter((offering) => (offering.gradeIds || []).some((id) => objectIdString(id) === objectIdString(classGroup.gradeId)))
    : direct;
  if (contextual.length === 1) return { status: "resolved" as const, candidates: contextual, source: "exact" as const, note: "Matched the school's active subject offering." };
  if (direct.length === 1) return { status: "resolved" as const, candidates: direct, source: "alias" as const, note: "Matched a normalized subject offering alias." };

  const family = subjectFamilyForToken(token);
  let familyMatches = restrictToClassOfferings(
    offerings.filter((offering) => normalizeTeacherImportLookup(offering.subjectFamily || "") === family),
    classGroup
  );
  if (classGroup) {
    familyMatches = familyMatches.filter((offering) =>
      (offering.gradeIds || []).some((id) => objectIdString(id) === objectIdString(classGroup.gradeId))
    );
  }
  if (familyMatches.length === 1) {
    return {
      status: "resolved" as const,
      candidates: familyMatches,
      source: "inferred" as const,
      note: "Matched the subject family using the teacher's resolved grade context.",
    };
  }
  return {
    status: familyMatches.length > 1 || direct.length > 1 ? ("needs_review" as const) : ("blocked" as const),
    candidates: unique([...contextual, ...direct, ...familyMatches], (item) => objectIdString(item._id)),
    source: "inferred" as const,
    note: familyMatches.length > 1
      ? "Several school offerings share this subject family; choose the offering for this grade."
      : "No compatible active subject offering was found in this school.",
  };
}

export function dedupeTeacherImportClassMatches<T extends { _id: unknown }>(matches: T[]) {
  return unique(matches, (item) => objectIdString(item._id));
}

async function existingTeacherIndexes(rows: TeacherImportRow[], schoolId: mongoose.Types.ObjectId) {
  const emails = unique(rows.map((row) => row.email.toLowerCase()).filter(Boolean), (value) => value);
  const employeeIds = unique(rows.map((row) => clean(row.employeeId)).filter(Boolean), normalizeTeacherImportLookup);
  const users = await User.find({ email: { $in: emails } }).select("_id email firstName lastName").lean();
  const userByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
  const userIds = users.map((user) => user._id);
  const teachers = await Teacher.find({
    schoolId,
    $or: [
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ...(employeeIds.length ? [{ employeeId: { $in: employeeIds } }] : []),
    ],
  }).select("_id userId employeeId").lean();
  const usersById = new Map(users.map((user) => [objectIdString(user._id), user]));
  return { userByEmail, usersById, teachers };
}

export async function analyzeTeacherImport(input: {
  schoolId: mongoose.Types.ObjectId;
  fileName: string;
  fileBytes: Buffer;
  selectedSheetName?: string | null;
  columnMappings?: ITeacherImportColumnMapping[];
  preserved?: {
    subjectResolutions?: ITeacherImportSubjectResolution[];
    classResolutions?: ITeacherImportClassResolution[];
    analysisIssues?: ImportIssueV2[];
  };
  /** Test/infrastructure seam for replacing only the external Leo boundary. */
  leo?: TeacherImportLeoDependencies;
}): Promise<TeacherImportAnalysisResult> {
  // The production path is AI-first: every source header is submitted to Leo
  // before parsing values. The injected dependency exception keeps existing
  // semantic-only test seams from accidentally calling a real provider.
  const aiFirstColumnMapping = !input.columnMappings?.length && (!input.leo || Boolean(input.leo.suggestHeaders));
  const parseOptions: TeacherImportParseOptions = {
    selectedSheetName: input.selectedSheetName,
    columnMappings: input.columnMappings,
    mappingMode: aiFirstColumnMapping ? "leo_first" : "deterministic",
  };
  let parsed = parseTeacherImportWorkbook(input.fileBytes, input.fileName, parseOptions);
  let leoUsed = false;
  let leoUnavailable = false;
  let leoAnalysis: ImportLeoMetadata | null = null;
  const headersForLeo = parsed.columnMappings.map((mapping) => mapping.sourceHeader);
  const selectedSheet = parsed.sheets.find((sheet) => sheet.name === parsed.selectedSheetName);
  const headerSignals = headerSignalsForLeo(selectedSheet);
  let headerRationaleByHeader = new Map<string, string>();
  if (aiFirstColumnMapping && headersForLeo.length) {
    const headerLeo = await (input.leo?.suggestHeaders || suggestTeacherImportHeaders)({
      schoolId: input.schoolId,
      unresolvedHeaders: headersForLeo,
      headerSignals,
    });
    if (headerLeo.ok) {
      const suggestions = new Map(
        headerLeo.suggestions
          .filter((suggestion) => headersForLeo.includes(suggestion.sourceHeader))
          .map((suggestion) => [suggestion.sourceHeader, suggestion])
      );
      headerRationaleByHeader = new Map(
        headerLeo.suggestions.map((suggestion) => [suggestion.sourceHeader, suggestion.rationale])
      );
      const mappings = parsed.columnMappings.map((mapping) => {
          const suggestion = suggestions.get(mapping.sourceHeader);
          if (!suggestion) return mapping;
          return {
            ...mapping,
            canonicalField: suggestion.canonicalField,
            source: "leo" as const,
            confidence: suggestion.confidence,
            // Leo proposes the mapping; the admin confirms it in the review
            // surface before a re-analysis is allowed to proceed.
            status: "needs_review" as const,
          };
        });
      parsed = parseTeacherImportWorkbook(input.fileBytes, input.fileName, {
        selectedSheetName: input.selectedSheetName,
        columnMappings: mappings,
      });
      leoUsed = true;
    } else {
      leoUnavailable = true;
    }
  }
  const [offerings, grades, classes] = await Promise.all([
    SubjectOffering.find({ schoolId: input.schoolId, isActive: true })
      .select("_id subjectId displayName shortName code subjectFamily gradeIds gradeBand stage")
      .lean<OfferingRecord[]>(),
    Grade.find({ schoolId: input.schoolId, isActive: true }).select("_id name code stage order").lean<GradeRecord[]>(),
    ClassGroup.find({ schoolId: input.schoolId, isActive: true })
      .select("_id name gradeId homeroomTeacherId subjectOfferingIds")
      .lean<ClassRecord[]>(),
  ]);
  const gradeNames = new Map(grades.map((grade) => [objectIdString(grade._id), grade.name]));
  const classMap = lookupClasses(classes, gradeNames);
  const understandingGradeById = new Map((grades as TeacherUnderstandingGrade[]).map((grade) => [objectIdString(grade._id), grade]));
  for (const classGroup of classes as TeacherUnderstandingClass[]) {
    for (const alias of understandingClassAliases(classGroup, understandingGradeById.get(objectIdString(classGroup.gradeId)))) {
      const current = classMap.get(alias) || [];
      classMap.set(alias, unique([...current, classGroup as ClassRecord], (item) => objectIdString(item._id)));
    }
  }
  const existing = await existingTeacherIndexes(parsed.rows, input.schoolId);
  const teacherByUserId = new Map(existing.teachers.map((teacher) => [objectIdString(teacher.userId), teacher]));
  const teacherByEmployeeId = new Map(existing.teachers.filter((teacher) => teacher.employeeId).map((teacher) => [normalizeTeacherImportLookup(String(teacher.employeeId)), teacher]));
  const occupiedTeacherIds = unique(
    classes.map((classGroup) => classGroup.homeroomTeacherId).filter(Boolean) as IdLike[],
    objectIdString
  );
  const occupiedTeachers = occupiedTeacherIds.length
    ? await Teacher.find({ _id: { $in: occupiedTeacherIds }, schoolId: input.schoolId }).select("_id userId employeeId").lean()
    : [];
  const occupiedUserIds = occupiedTeachers.map((teacher) => teacher.userId);
  const occupiedUsers = occupiedUserIds.length
    ? await User.find({ _id: { $in: occupiedUserIds } }).select("_id firstName lastName").lean()
    : [];
  const occupiedUsersById = new Map(occupiedUsers.map((user) => [objectIdString(user._id), user]));
  const occupiedTeacherById = new Map(occupiedTeachers.map((teacher) => [objectIdString(teacher._id), teacher]));

  const subjectGroups = new Map<string, ITeacherImportSubjectResolution>();
  const classGroups = new Map<string, ITeacherImportClassResolution>();
  const rows: ITeacherImportParsedRow[] = [];
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();
  const seenEmployeeIds = new Map<string, number>();

  for (const sourceRow of parsed.rows) {
    const issues: ITeacherImportIssue[] = [];
    const status = statusValue(sourceRow.status);
    const currentRowClassMatches = findClassMatches(sourceRow, classes, gradeNames, classMap);
    const classGroup = currentRowClassMatches.length === 1 ? currentRowClassMatches[0] : null;
    if (!sourceRow.firstName || !sourceRow.lastName) {
      issues.push(issue("missing_required", "Add a first and last name before confirming this row.", "name"));
    }
    if (sourceRow.fullName && !sourceRow.lastName) {
      issues.push(issue("name_split_review", "The full name was split automatically; confirm the proposed first and last name."));
    }
    if (!sourceRow.email) {
      issues.push(issue("missing_required", "Choose the column containing each teacher's email address.", "email"));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sourceRow.email)) {
      issues.push(issue("invalid", `"${sourceRow.email}" is not a valid email address.`, "email", sourceRow.email));
    }
    if (sourceRow.email) {
      const prior = seenEmails.get(sourceRow.email);
      if (prior) issues.push(issue("duplicate", `This email is duplicated inside the file (first seen on row ${prior}).`, "email", sourceRow.email));
      else seenEmails.set(sourceRow.email, sourceRow.sourceRowNumber);
    }
    if (sourceRow.employeeId) {
      const employeeKey = normalizeTeacherImportLookup(sourceRow.employeeId);
      const prior = seenEmployeeIds.get(employeeKey);
      if (prior) issues.push(issue("duplicate", `This employee ID is duplicated inside the file (first seen on row ${prior}).`, "employeeId", sourceRow.employeeId));
      else seenEmployeeIds.set(employeeKey, sourceRow.sourceRowNumber);
    }
    const normalizedPhone = normalizeGhanaPhoneForStorage(sourceRow.phone);
    if (normalizedPhone) {
      const prior = seenPhones.get(normalizedPhone);
      if (prior) issues.push(issue("duplicate", `This phone number is duplicated inside the file (first seen on row ${prior}).`, "phone", normalizedPhone));
      else seenPhones.set(normalizedPhone, sourceRow.sourceRowNumber);
    }
    if (status.status === "needs_review") {
      issues.push(issue("status_review", `Employment status "${sourceRow.status}" needs confirmation.`, "status", sourceRow.status || ""));
    }

    let resolvedClassId: string | null = null;
    if (sourceRow.homeroomClass || sourceRow.homeroomGrade || sourceRow.homeroomClassGroupId) {
      const sourceValue = [clean(sourceRow.homeroomGrade), clean(sourceRow.homeroomClass)].filter(Boolean).join(" ") || clean(sourceRow.homeroomClassGroupId);
      const classResolutionKey = normalizeTeacherImportLookup(sourceValue);
      const classResolution = classGroups.get(classResolutionKey);
      if (currentRowClassMatches.length === 1) {
        resolvedClassId = objectIdString(currentRowClassMatches[0]._id);
        const occupiedTeacherId = currentRowClassMatches[0].homeroomTeacherId ? objectIdString(currentRowClassMatches[0].homeroomTeacherId) : null;
        const occupiedTeacher = occupiedTeacherId ? occupiedTeacherById.get(occupiedTeacherId) : null;
        const occupiedUser = occupiedTeacher ? occupiedUsersById.get(objectIdString(occupiedTeacher.userId)) : null;
        const resolution: ITeacherImportClassResolution = classResolution || {
          sourceValue,
          classGroupId: resolvedClassId,
          gradeId: objectIdString(currentRowClassMatches[0].gradeId),
          resolvedLabel: classLabel(currentRowClassMatches[0], gradeNames),
          candidateOptions: [{
            id: objectIdString(currentRowClassMatches[0]._id),
            label: classLabel(currentRowClassMatches[0], gradeNames),
            gradeId: objectIdString(currentRowClassMatches[0].gradeId),
          }],
          source: sourceRow.homeroomClassGroupId ? "exact" : "alias",
          status: occupiedTeacherId ? "needs_review" : "resolved",
          affectedRows: [],
          occupiedTeacherId,
          occupiedTeacherName: occupiedUser ? [occupiedUser.firstName, occupiedUser.lastName].filter(Boolean).join(" ") : null,
          homeroomDecision: occupiedTeacherId ? null : "replace",
          note: occupiedTeacherId ? "This class already has a homeroom teacher; choose whether to keep or replace them." : null,
        };
        resolution.affectedRows = unique([...resolution.affectedRows, sourceRow.sourceRowNumber], String);
        classGroups.set(classResolutionKey, resolution);
        if (occupiedTeacherId) issues.push(issue("occupied_homeroom", `${resolution.resolvedLabel} already has a homeroom teacher. Choose keep, replace, or do not assign.`, "homeroomClass", sourceValue));
      } else if (currentRowClassMatches.length > 1) {
        issues.push(issue("ambiguous", `Homeroom "${sourceValue}" matches multiple distinct classes.`, "homeroomClass", sourceValue));
        const key = normalizeTeacherImportLookup(sourceValue);
        const resolution = classGroups.get(key) || {
          sourceValue,
          source: "inferred" as const,
          status: "needs_review" as const,
          affectedRows: [],
          candidateOptions: currentRowClassMatches.map((item) => ({
            id: objectIdString(item._id),
            label: classLabel(item, gradeNames),
            gradeId: objectIdString(item.gradeId),
          })),
          note: currentRowClassMatches.map((item) => classLabel(item, gradeNames)).join(", "),
        };
        resolution.affectedRows = unique([...resolution.affectedRows, sourceRow.sourceRowNumber], String);
        classGroups.set(key, resolution);
      } else {
        issues.push(issue("not_found", `Homeroom "${sourceValue}" was not found among this school's active class groups.`, "homeroomClass", sourceValue));
        const gradeId = matchingGradeId(sourceRow.homeroomGrade, grades);
        const candidateClasses = gradeId
          ? classes.filter((item) => objectIdString(item.gradeId) === objectIdString(gradeId))
          : classes;
        const key = normalizeTeacherImportLookup(sourceValue);
        const resolution = classGroups.get(key) || {
          sourceValue,
          source: "inferred" as const,
          status: "needs_review" as const,
          affectedRows: [],
          candidateOptions: candidateClasses.map((item) => ({
            id: objectIdString(item._id),
            label: classLabel(item, gradeNames),
            gradeId: objectIdString(item.gradeId),
          })),
          note: candidateClasses.length ? "Choose the matching active class group, or choose do not assign homeroom." : "No active class groups are available for this school.",
        };
        resolution.affectedRows = unique([...resolution.affectedRows, sourceRow.sourceRowNumber], String);
        classGroups.set(key, resolution);
      }
    }

    const understandingGrades = grades as TeacherUnderstandingGrade[];
    const understandingClasses = classes as TeacherUnderstandingClass[];
    const understandingOfferings = offerings as TeacherUnderstandingOffering[];
    const gradeById = new Map(understandingGrades.map((grade) => [objectIdString(grade._id), grade]));
    const gradeScopeIds: string[] = [];
    const classScopeIds: string[] = [];
    const classScopeRecords: TeacherUnderstandingClass[] = [];
    for (const gradeValue of sourceRow.gradeScopes || []) {
      const matches = resolveGradeLabel(gradeValue, understandingGrades);
      if (matches.length === 1) gradeScopeIds.push(objectIdString(matches[0]._id));
      else issues.push(issue("grade_scope_review", matches.length ? `Grade "${gradeValue}" matches multiple school grades.` : `Grade "${gradeValue}" was not found in this school.`, "gradeScopes", gradeValue));
    }
    for (const classValue of sourceRow.classScopes || []) {
      const resolvedScope = resolveClassLabel(classValue, understandingGrades, understandingClasses);
      if (resolvedScope.candidates.length === 1) {
        classScopeIds.push(objectIdString(resolvedScope.candidates[0]._id));
        classScopeRecords.push(resolvedScope.candidates[0]);
      } else {
        issues.push(issue("class_scope_review", `${resolvedScope.note} Teaching class "${classValue}" requires review.`, "classScopes", classValue));
      }
    }
    const contexts: TeacherContext[] = [];
    if (classGroup) {
      const grade = gradeById.get(objectIdString(classGroup.gradeId));
      contexts.push({ gradeId: objectIdString(classGroup.gradeId), gradeName: grade?.name || null, gradeBand: grade ? gradeBandForGrade(grade) : null, classGroupId: objectIdString(classGroup._id), classLabel: classLabel(classGroup, gradeNames), source: "homeroom" });
    }
    for (const classScope of classScopeRecords) {
      const grade = gradeById.get(objectIdString(classScope.gradeId));
      contexts.push({ gradeId: objectIdString(classScope.gradeId), gradeName: grade?.name || null, gradeBand: grade ? gradeBandForGrade(grade) : null, classGroupId: objectIdString(classScope._id), classLabel: `${grade?.name || "Grade"} / ${classScope.name}`, source: "class_scope" });
    }
    for (const gradeId of [...new Set(gradeScopeIds)]) {
      const grade = gradeById.get(gradeId);
      if (grade) contexts.push({ gradeId, gradeName: grade.name, gradeBand: gradeBandForGrade(grade), source: "grade_scope" });
    }
    if (!contexts.length && sourceRow.homeroomGrade) {
      const matches = resolveGradeLabel(sourceRow.homeroomGrade, understandingGrades);
      if (matches.length === 1) contexts.push({ gradeId: objectIdString(matches[0]._id), gradeName: matches[0].name, gradeBand: gradeBandForGrade(matches[0]), source: "homeroom" });
    }
    const uniqueContexts = unique(contexts, (context) => `${context.classGroupId || ""}:${context.gradeId || ""}`);

    const subjectOfferingIds: string[] = [];
    const subjectIds: string[] = [];
    const subjectTokens = splitTokens(sourceRow.subjects);
    const directIdTokens = splitTokens(sourceRow.subjectOfferingIds);
    for (const token of directIdTokens) {
      const id = toObjectId(token);
      const offering = id ? offerings.find((item) => objectIdString(item._id) === id.toString()) : null;
      if (!offering) {
        issues.push(issue("invalid", `Subject offering ID "${token}" is not an active offering in this school.`, "subjects", token));
        continue;
      }
      subjectOfferingIds.push(objectIdString(offering._id));
      subjectIds.push(objectIdString(offering.subjectId));
    }
    const subjectContexts = uniqueContexts.length ? uniqueContexts : [null];
    for (const token of subjectTokens) {
      for (const context of subjectContexts) {
        const contextClass = context?.classGroupId ? understandingClasses.find((item) => objectIdString(item._id) === context.classGroupId) || null : null;
        const resolved = resolveSubjectForContext({ sourceValue: token, context, classGroup: contextClass, offerings: understandingOfferings });
        const key = teacherImportResolutionKey(token, context?.gradeId || null);
        const prior = subjectGroups.get(key);
        const manualCandidates = resolved.candidates.length > 0
          ? resolved.candidates
          : context?.gradeId
            ? understandingOfferings.filter((offering) => (offering.gradeIds || []).some((gradeId) => objectIdString(gradeId) === context.gradeId))
            : understandingOfferings;
        const group: ITeacherImportSubjectResolution = prior || {
          resolutionKey: key,
          sourceValue: token,
          subjectFamily: resolved.candidates[0]?.subjectFamily || subjectFamilyForToken(token),
          subjectOfferingIds: [],
          resolvedNames: [],
          source: resolved.source,
          status: resolved.status,
          affectedRows: [],
          candidateOptions: manualCandidates.map((offering) => ({ id: objectIdString(offering._id), label: offering.displayName, gradeBand: offering.gradeBand })),
          note: resolved.note,
          contextGradeIds: resolved.contextGradeIds,
          resolutionClass: resolved.resolutionClass,
          requiresHumanConfirmation: resolved.requiresHumanConfirmation,
          provenance: [provenance({ field: "subjects", sourceValue: token, source: resolved.source, note: context?.gradeName ? `Context: ${context.gradeName}` : null })],
        };
        group.affectedRows = unique([...group.affectedRows, sourceRow.sourceRowNumber], String);
        if (resolved.status === "resolved") {
          for (const offering of resolved.candidates) {
            group.subjectOfferingIds.push(objectIdString(offering._id));
            group.resolvedNames.push(offering.displayName);
            subjectOfferingIds.push(objectIdString(offering._id));
            subjectIds.push(objectIdString(offering.subjectId));
          }
          group.subjectOfferingIds = unique(group.subjectOfferingIds, String);
          group.resolvedNames = unique(group.resolvedNames, String);
        } else {
          // Subject association is intentionally reviewable: no subject
          // offering should make a valid teacher identity uncommittable.
          issues.push(issue(resolved.stageMismatch ? "stage_mismatch" : "subject_review", `${resolved.note} Source value: "${token}".`, "subjects", token));
        }
        subjectGroups.set(key, group);
      }
    }

    const explicitAssignments = sourceRow.explicitAssignments.flatMap((assignment) => {
      const parsedAssignments: Array<{ sourceValue: string; subjectValue: string; classValue: string; gradeValue?: string }> = assignment.subjectValue
        ? [{ sourceValue: assignment.sourceValue, subjectValue: assignment.subjectValue, classValue: assignment.classValue || "", gradeValue: assignment.gradeValue || undefined }]
        : parseTeacherAssignmentText(assignment.sourceValue).map((parsed) => ({
          ...parsed,
        }));
      return parsedAssignments.map((parsed) => {
        const classResolution = resolveClassLabel(parsed.classValue, understandingGrades, understandingClasses);
        const classCandidate = classResolution.candidates.length === 1 ? classResolution.candidates[0] : null;
        const grade = classCandidate ? gradeById.get(objectIdString(classCandidate.gradeId)) : null;
        const subjectResolution = resolveSubjectForContext({
          sourceValue: parsed.subjectValue,
          context: classCandidate ? { gradeId: objectIdString(classCandidate.gradeId), gradeName: grade?.name || null, gradeBand: grade ? gradeBandForGrade(grade) : null, classGroupId: objectIdString(classCandidate._id), source: "assignment" } : null,
          classGroup: classCandidate,
          offerings: understandingOfferings,
        });
        return assignmentFromResolution({
          parsed,
          classResolution,
          subjectResolution,
          provenance: assignment.provenance || [provenance({ field: "explicitAssignments", sourceValue: parsed.sourceValue, source: assignment.source })],
        });
      });
    });
    for (const assignment of explicitAssignments) {
      if (assignment.status !== "resolved") issues.push(issue(assignment.issueCode || "assignment_review", `Explicit teaching assignment "${assignment.sourceValue}" needs review. ${assignment.note || ""}`.trim(), "explicitAssignments", assignment.sourceValue));
    }

    const normalizedEmail = sourceRow.email.toLowerCase();
    const matchedUser = normalizedEmail ? existing.userByEmail.get(normalizedEmail) : null;
    const matchedTeacher = (matchedUser && teacherByUserId.get(objectIdString(matchedUser._id))) || (sourceRow.employeeId && teacherByEmployeeId.get(normalizeTeacherImportLookup(sourceRow.employeeId))) || null;
    if (matchedTeacher) issues.push(issue("existing", "A teacher already exists for this email or employee ID. The default action is to skip it.", "email", normalizedEmail));

    const statusResult = matchedTeacher ? "resolved" : resolutionStatus(issues.filter((item) => item.code !== "existing"));
    rows.push({
      sourceRowNumber: sourceRow.sourceRowNumber,
      rowRef: `T${String(sourceRow.sourceRowNumber).padStart(3, "0")}`,
      sourceValues: sourceRow.sourceValues,
      firstName: sourceRow.firstName,
      middleNames: sourceRow.middleNames,
      lastName: sourceRow.lastName,
      fullName: sourceRow.fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      employeeId: sourceRow.employeeId,
      department: sourceRow.department,
      status: status.value,
      subjects: subjectTokens,
      gradeScopes: sourceRow.gradeScopes,
      gradeScopeIds: unique(gradeScopeIds, String),
      classScopes: sourceRow.classScopes,
      classScopeIds: unique(classScopeIds, String),
      explicitAssignments,
      subjectOfferingIds: unique(subjectOfferingIds, String),
      subjectIds: unique(subjectIds, String),
      homeroomClass: sourceRow.homeroomClass,
      homeroomGrade: sourceRow.homeroomGrade,
      homeroomClassGroupId: resolvedClassId,
      resolutionStatus: statusResult,
      rowState: rowState(statusResult, Boolean(matchedTeacher)),
      issues,
      teacherId: matchedTeacher ? objectIdString(matchedTeacher._id) : null,
      invitation: { status: "not_requested", warning: null, invitationId: null },
      provenance: [
        provenance({ field: "firstName", sourceValue: sourceRow.firstName, source: sourceRow.fullName ? "inferred" : "exact" }),
        provenance({ field: "lastName", sourceValue: sourceRow.lastName, source: sourceRow.fullName ? "inferred" : "exact" }),
      ],
    });
  }

  const subjectResolutions = [...subjectGroups.values()].map((group) => ({
    ...group,
    subjectOfferingIds: unique(group.subjectOfferingIds, String),
    resolvedNames: unique(group.resolvedNames, String),
  }));
  const classResolutions = [...classGroups.values()];
  for (const identityField of ["email", "phone", "employeeId"] as const) {
    const groups = new Map<string, ITeacherImportParsedRow[]>();
    for (const row of rows) {
      const raw = identityField === "employeeId" ? row.employeeId : row[identityField];
      const key = normalizeTeacherImportLookup(raw || "");
      if (!key) continue;
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    for (const affected of groups.values()) {
      if (affected.length < 2) continue;
      const rowNumbers = affected.map((row) => row.sourceRowNumber);
      for (const row of affected) {
        if (!row.issues.some((item) => item.code === "duplicate" && item.field === identityField)) {
          row.issues.push(issue("duplicate", `This ${identityField} is duplicated inside the file. Confirm the affected teacher records before continuing.`, identityField, identityField === "employeeId" ? row.employeeId || "" : row[identityField] || "", rowNumbers));
        }
        if (row.rowState !== "existing") {
          row.resolutionStatus = resolutionStatus(row.issues);
          row.rowState = rowState(row.resolutionStatus, false);
        }
      }
    }
  }
  const sourceTeacherIdentityGroups = new Map<string, ITeacherImportParsedRow[]>();
  for (const row of rows) {
    const identity = normalizeTeacherImportLookup([row.firstName, ...row.middleNames, row.lastName].filter(Boolean).join(" "));
    if (!identity) continue;
    sourceTeacherIdentityGroups.set(identity, [...(sourceTeacherIdentityGroups.get(identity) || []), row]);
  }
  for (const affected of sourceTeacherIdentityGroups.values()) {
    if (affected.length < 2) continue;
    const rowNumbers = affected.map((row) => row.sourceRowNumber);
    for (const row of affected) {
      row.issues.push(issue("duplicate_source_teacher", "The same teacher name appears more than once in this import. Confirm whether these are duplicate records or distinct people.", "name", [row.firstName, ...row.middleNames, row.lastName].join(" "), rowNumbers));
      row.resolutionStatus = resolutionStatus(row.issues);
      row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
    }
  }
  // A homeroom is a single-valued relationship. Multiple import rows naming
  // the same class must remain visible to the administrator, even when the
  // rows represent legitimate co-teaching for subjects.
  const homeroomRows = new Map<string, ITeacherImportParsedRow[]>();
  for (const row of rows) {
    if (!row.homeroomClassGroupId || row.rowState === "existing") continue;
    const current = homeroomRows.get(row.homeroomClassGroupId) || [];
    current.push(row);
    homeroomRows.set(row.homeroomClassGroupId, current);
  }
  for (const [classGroupId, affected] of homeroomRows) {
    if (affected.length < 2) continue;
    const rowNumbers = affected.map((row) => row.sourceRowNumber);
    const conflict = issue("duplicate_homeroom", "More than one new teacher claims this homeroom class. Choose one homeroom teacher; subject profiles remain separate.", "homeroomClassGroupId", classGroupId, rowNumbers);
    for (const row of affected) {
      row.issues.push(conflict);
      row.resolutionStatus = resolutionStatus(row.issues);
      row.rowState = rowState(row.resolutionStatus, false);
    }
  }

  const explicitAssignmentRows = rows.flatMap((row) => row.explicitAssignments.map((assignment) => ({ row, assignment })));
  const duplicateAssignmentGroups = new Map<string, Array<{ row: ITeacherImportParsedRow; assignment: typeof explicitAssignmentRows[number]["assignment"] }>>();
  for (const entry of explicitAssignmentRows) {
    if (entry.assignment.status !== "resolved" || !entry.assignment.classGroupId || !entry.assignment.subjectOfferingId) continue;
    const key = `${entry.assignment.classGroupId}:${entry.assignment.subjectOfferingId}`;
    duplicateAssignmentGroups.set(key, [...(duplicateAssignmentGroups.get(key) || []), entry]);
  }
  for (const affected of duplicateAssignmentGroups.values()) {
    if (affected.length < 2) continue;
    const rowNumbers = affected.map((item) => item.row.sourceRowNumber);
    for (const item of affected) {
      item.row.issues.push(issue("duplicate_explicit_assignment", "The same explicit teaching assignment appears more than once in this import.", "explicitAssignments", item.assignment.sourceValue, rowNumbers));
      item.assignment.status = "needs_review";
      item.assignment.issueCode = "duplicate_explicit_assignment";
      item.assignment.note = "Review the repeated assignment; co-teaching may be intentional.";
      item.row.resolutionStatus = resolutionStatus(item.row.issues);
      item.row.rowState = rowState(item.row.resolutionStatus, item.row.rowState === "existing");
    }
  }
  if (explicitAssignmentRows.length) {
    const classIds = [...new Set(explicitAssignmentRows.map((item) => item.assignment.classGroupId).filter((value): value is string => Boolean(value)))];
    const offeringIds = [...new Set(explicitAssignmentRows.map((item) => item.assignment.subjectOfferingId).filter((value): value is string => Boolean(value)))];
    const existingAssignments = await TeacherAssignment.find({
      schoolId: input.schoolId,
      status: "active",
      classGroupId: { $in: classIds },
      subjectOfferingId: { $in: offeringIds },
    }).select("teacherId classGroupId subjectOfferingId").lean();
    for (const entry of explicitAssignmentRows) {
      if (entry.assignment.status !== "resolved") continue;
      const overlap = existingAssignments.find((existing) => objectIdString(existing.classGroupId) === entry.assignment.classGroupId && objectIdString(existing.subjectOfferingId) === entry.assignment.subjectOfferingId);
      if (!overlap) continue;
      entry.assignment.status = "needs_review";
      entry.assignment.issueCode = "assignment_overlap";
      entry.assignment.note = "Another active teacher already has this class and subject offering. Co-teaching may be intentional.";
      entry.row.issues.push(issue("assignment_overlap", "Another teacher is already assigned to this subject in this class. Review whether co-teaching is intentional.", "explicitAssignments", entry.assignment.sourceValue, [entry.row.sourceRowNumber]));
      entry.row.resolutionStatus = resolutionStatus(entry.row.issues);
      entry.row.rowState = rowState(entry.row.resolutionStatus, entry.row.rowState === "existing");
    }
  }
  const unresolvedSubjects = unique(
    subjectResolutions.filter((item) => item.status !== "resolved").map((item) => item.sourceValue),
    normalizeTeacherImportLookup
  );
  const unresolvedClasses = unique(
    rows
      .filter((row) => row.issues.some((item) => ["not_found", "ambiguous", "class_scope_review"].includes(item.code) && ["homeroomClass", "classScopes"].includes(item.field || "")))
      .flatMap((row) => [[clean(row.homeroomGrade), clean(row.homeroomClass)].filter(Boolean).join(" "), ...row.classScopes])
      .filter(Boolean),
    normalizeTeacherImportLookup
  );
  {
    const leo = await (input.leo?.suggestSemantics || suggestTeacherImportSemantics)({
      schoolId: input.schoolId,
      unresolvedSubjects,
      unresolvedClasses,
      subjectCatalog: offerings.map((offering) => ({
        subjectFamily: offering.subjectFamily || "",
        displayName: offering.displayName,
        shortName: offering.shortName || "",
        gradeBand: offering.gradeBand || "",
        stage: offering.stage || "",
      })),
      gradeCatalog: grades.map((grade) => grade.name),
      classCatalog: classes.map((classGroup) => ({
        gradeName: gradeNames.get(objectIdString(classGroup.gradeId)) || "",
        className: classGroup.name,
      })),
      subjectValues: unique(rows.flatMap((row) => row.subjects), normalizeTeacherImportLookup),
      gradeValues: unique(rows.flatMap((row) => [...row.gradeScopes, row.homeroomGrade || ""]), normalizeTeacherImportLookup).filter(Boolean),
      classValues: unique(rows.flatMap((row) => [...row.classScopes, row.homeroomClass || ""]), normalizeTeacherImportLookup).filter(Boolean),
      issueTypes: unique(rows.flatMap((row) => row.issues.map((item) => item.code)), (value) => value),
    });
    leoAnalysis = leo.metadata || null;
    if (leo.ok) {
      leoUsed = true;
      for (const suggestion of leo.suggestions.subjectSuggestions) {
        for (const resolution of subjectResolutions.filter((item) => normalizeTeacherImportLookup(item.sourceValue) === normalizeTeacherImportLookup(suggestion.sourceValue) && item.status !== "resolved")) {
          const family = normalizeTeacherImportLookup(suggestion.suggestedSubjectFamily || "");
          if (!family) continue;
          const candidates = offerings.filter((offering) => normalizeTeacherImportLookup(offering.subjectFamily || "") === family);
          const sourceFamily = normalizeTeacherImportLookup(resolution.subjectFamily || subjectFamilyForToken(resolution.sourceValue));
          if (sourceFamily && family !== sourceFamily) {
            const compatibleCandidates = candidates.filter((offering) =>
              !(resolution.contextGradeIds || []).length ||
              (offering.gradeIds || []).some((gradeId) => resolution.contextGradeIds?.includes(objectIdString(gradeId)))
            );
            resolution.candidateOptions = compatibleCandidates.map((offering) => ({ id: objectIdString(offering._id), label: offering.displayName, gradeBand: offering.gradeBand }));
            resolution.note = `Leo suggested a different subject family (${suggestion.suggestedSubjectFamily}); this semantic substitution requires administrator confirmation.`;
            resolution.source = "leo";
            resolution.status = "needs_review";
            resolution.resolutionClass = "REVIEW";
            resolution.requiresHumanConfirmation = true;
            for (const row of rows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
              row.issues = row.issues.filter((item) => !(["not_found", "subject_review"].includes(item.code) && item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === normalizeTeacherImportLookup(resolution.sourceValue)));
              if (!row.issues.some((item) => item.code === "semantic_substitution_review" && item.value === resolution.sourceValue)) {
                row.issues.push(issue("semantic_substitution_review", `Leo suggested "${suggestion.suggestedSubjectFamily}" for "${resolution.sourceValue}", but this is not an automatic subject substitution.`, "subjects", resolution.sourceValue, [row.sourceRowNumber]));
              }
              row.resolutionStatus = resolutionStatus(row.issues);
              row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
            }
            continue;
          }
          const contextual = unique(
            resolution.affectedRows.flatMap((rowNumber) => {
              const row = rows.find((item) => item.sourceRowNumber === rowNumber);
              const classGroup = row?.homeroomClassGroupId
                ? classes.find((item) => objectIdString(item._id) === row.homeroomClassGroupId)
                : null;
              return classGroup
                ? candidates.filter((offering) => (offering.gradeIds || []).some((id) => objectIdString(id) === objectIdString(classGroup.gradeId)))
                : candidates;
            }),
            (item) => objectIdString(item._id)
          );
          if (contextual.length === 1) {
            resolution.subjectFamily = contextual[0].subjectFamily;
            resolution.subjectOfferingIds = [objectIdString(contextual[0]._id)];
            resolution.resolvedNames = [contextual[0].displayName];
            resolution.source = "leo";
            resolution.status = "resolved";
            resolution.note = `Leo suggested ${suggestion.suggestedSubjectFamily}; EduSentrix validated the unique school offering against the row's grade context.`;
            for (const row of rows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
              row.subjectOfferingIds = unique([...row.subjectOfferingIds, objectIdString(contextual[0]._id)], String);
              row.subjectIds = unique([...row.subjectIds, objectIdString(contextual[0].subjectId)], String);
              row.issues = row.issues.filter((item) => !(item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === normalizeTeacherImportLookup(resolution.sourceValue)));
              row.resolutionStatus = resolutionStatus(row.issues);
              row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
            }
          }
        }
      }
      for (const suggestion of leo.suggestions.semanticSubstitutionSuggestions || []) {
        for (const resolution of subjectResolutions.filter((item) => normalizeTeacherImportLookup(item.sourceValue) === normalizeTeacherImportLookup(suggestion.sourceValue) && item.status !== "resolved")) {
          const candidates = offerings.filter((offering) => normalizeTeacherImportLookup(offering.subjectFamily || "") === normalizeTeacherImportLookup(suggestion.candidateSubjectFamily));
          if (!candidates.length) continue;
          const compatibleCandidates = candidates.filter((offering) =>
            !(resolution.contextGradeIds || []).length ||
            (offering.gradeIds || []).some((gradeId) => resolution.contextGradeIds?.includes(objectIdString(gradeId)))
          );
          resolution.candidateOptions = compatibleCandidates.map((offering) => ({ id: objectIdString(offering._id), label: offering.displayName, gradeBand: offering.gradeBand }));
          resolution.note = `${suggestion.rationale} This is a semantic substitution and requires administrator confirmation.`;
          resolution.source = "leo";
          resolution.status = "needs_review";
          resolution.resolutionClass = "REVIEW";
          resolution.requiresHumanConfirmation = true;
          for (const row of rows.filter((item) => resolution.affectedRows.includes(item.sourceRowNumber))) {
            row.issues = row.issues.filter((item) => !(["not_found", "subject_review"].includes(item.code) && item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === normalizeTeacherImportLookup(resolution.sourceValue)));
            row.issues.push(issue("semantic_substitution_review", `Leo suggested "${suggestion.candidateSubjectFamily}" for "${suggestion.sourceValue}", but this is not an automatic subject substitution.`, "subjects", suggestion.sourceValue, [row.sourceRowNumber]));
            row.resolutionStatus = resolutionStatus(row.issues);
            row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
          }
        }
      }
      for (const suggestion of leo.suggestions.stageMismatchSuggestions || []) {
        for (const row of rows.filter((item) => suggestion.rowRefs.includes(`T${String(item.sourceRowNumber).padStart(3, "0")}`))) {
          if (row.issues.some((item) => item.code === "stage_mismatch" && item.value === suggestion.sourceValue)) continue;
          row.issues.push(issue("stage_mismatch", suggestion.rationale, "subjects", suggestion.sourceValue, [row.sourceRowNumber]));
          row.resolutionStatus = resolutionStatus(row.issues);
          row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
        }
      }
      for (const suggestion of leo.suggestions.classSuggestions) {
        const source = normalizeTeacherImportLookup(suggestion.sourceValue);
        const candidates = classes.filter((classGroup) => {
          const gradeName = gradeNames.get(objectIdString(classGroup.gradeId)) || "";
          return (!suggestion.suggestedGradeName || normalizeTeacherImportLookup(gradeName) === normalizeTeacherImportLookup(suggestion.suggestedGradeName)) &&
            (!suggestion.suggestedClassName || normalizeTeacherImportLookup(classGroup.name) === normalizeTeacherImportLookup(suggestion.suggestedClassName));
        });
        if (candidates.length !== 1) continue;
        const candidate = candidates[0];
        if (candidate.homeroomTeacherId) continue;
        const resolution = classResolutions.find((item) => normalizeTeacherImportLookup(item.sourceValue) === source);
        if (resolution) {
          resolution.classGroupId = objectIdString(candidate._id);
          resolution.gradeId = objectIdString(candidate.gradeId);
          resolution.resolvedLabel = classLabel(candidate, gradeNames);
          resolution.candidateOptions = [{ id: objectIdString(candidate._id), label: classLabel(candidate, gradeNames), gradeId: objectIdString(candidate.gradeId) }];
          resolution.source = "leo";
          resolution.status = "resolved";
          resolution.homeroomDecision = "replace";
          resolution.note = `Leo suggested ${suggestion.suggestedGradeName || "the grade"} / ${suggestion.suggestedClassName || "the class"}; EduSentrix validated the unique active class group.`;
        }
        for (const row of rows.filter((item) => normalizeTeacherImportLookup([clean(item.homeroomGrade), clean(item.homeroomClass)].filter(Boolean).join(" ")) === source)) {
          row.homeroomClassGroupId = objectIdString(candidate._id);
          row.issues = row.issues.filter((item) => !(item.field === "homeroomClass"));
          row.resolutionStatus = resolutionStatus(row.issues);
          row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
        }
      }
    } else {
      leoUnavailable = true;
    }
  }
  for (const previous of input.preserved?.subjectResolutions || []) {
    if (previous.source !== "admin" || previous.status !== "resolved") continue;
    const next = subjectGroups.get(previous.resolutionKey);
    if (!next) continue;
    const valid = previous.subjectOfferingIds.every((offeringId) => next.candidateOptions?.some((candidate) => candidate.id === offeringId) || next.subjectOfferingIds.includes(offeringId));
    if (valid) {
      next.subjectOfferingIds = [...previous.subjectOfferingIds];
      next.resolvedNames = [...previous.resolvedNames];
      next.source = "admin";
      next.status = "resolved";
      next.resolutionClass = "AUTO";
      next.requiresHumanConfirmation = false;
      for (const row of rows.filter((item) => previous.affectedRows.includes(item.sourceRowNumber))) {
        row.subjectOfferingIds = unique([...row.subjectOfferingIds, ...previous.subjectOfferingIds], String);
        row.issues = row.issues.filter((item) => !(item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === normalizeTeacherImportLookup(previous.sourceValue)));
        row.resolutionStatus = resolutionStatus(row.issues);
        row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
      }
    } else {
      for (const row of rows.filter((item) => previous.affectedRows.includes(item.sourceRowNumber))) {
        row.issues.push(issue("admin_decision_invalidated", `A previous administrator selection for "${previous.sourceValue}" is no longer valid against the current school catalog.`, "subjects", previous.sourceValue, [row.sourceRowNumber]));
        row.resolutionStatus = resolutionStatus(row.issues);
        row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
      }
    }
  }
  for (const previous of input.preserved?.classResolutions || []) {
    if (previous.source !== "admin" || previous.status !== "resolved") continue;
    const next = classGroups.get(normalizeTeacherImportLookup(previous.sourceValue));
    if (!next) continue;
    const valid = !previous.classGroupId || classes.some((classGroup) => objectIdString(classGroup._id) === previous.classGroupId);
    if (valid) {
      next.classGroupId = previous.classGroupId;
      next.gradeId = previous.gradeId;
      next.resolvedLabel = previous.resolvedLabel;
      next.source = "admin";
      next.status = "resolved";
      next.homeroomDecision = previous.homeroomDecision;
      for (const row of rows.filter((item) => previous.affectedRows.includes(item.sourceRowNumber))) {
        row.homeroomClassGroupId = previous.homeroomDecision === "replace" ? previous.classGroupId || null : null;
        row.issues = row.issues.filter((item) => !(item.field === "homeroomClass" && normalizeTeacherImportLookup(item.value || "") === normalizeTeacherImportLookup(previous.sourceValue)));
        row.resolutionStatus = resolutionStatus(row.issues);
        row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
      }
    } else {
      for (const row of rows.filter((item) => previous.affectedRows.includes(item.sourceRowNumber))) {
        row.issues.push(issue("admin_decision_invalidated", `A previous administrator homeroom selection for "${previous.sourceValue}" is no longer valid.`, "homeroomClass", previous.sourceValue, [row.sourceRowNumber]));
        row.resolutionStatus = resolutionStatus(row.issues);
        row.rowState = rowState(row.resolutionStatus, row.rowState === "existing");
      }
    }
  }
  const analysisWarnings = rows.flatMap((row) => row.issues.filter((item) => ["existing", "name_split_review", "occupied_homeroom", "status_review", "subject_review", "stage_mismatch", "semantic_substitution_review", "assignment_overlap", "duplicate_explicit_assignment", "duplicate_source_teacher", "grade_scope_review", "class_scope_review", "assignment_review", "admin_decision_invalidated"].includes(item.code)));
  if (leoUnavailable) {
    analysisWarnings.push(issue("leo_unavailable", "Leo column mapping or vocabulary assistance was unavailable. Any unmapped columns must be mapped manually before confirmation."));
  }
  const analysisErrors = rows
    .filter((row) => row.rowState !== "existing")
    .flatMap((row) => row.issues.filter((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found"].includes(item.code)));
  const analysisIssueMap = new Map<string, ImportIssueV2>();
  for (const row of rows) {
    for (const item of row.issues) {
      // Subject review decisions are represented once below, with all of the
      // equivalent rows linked back to that group. Keep individual row issues
      // as provenance, but do not make twelve identical admin decisions.
      if (["subject_review", "semantic_substitution_review"].includes(item.code) && item.field === "subjects") continue;
      const blocking = ["missing_required", "invalid", "duplicate", "not_found", "blocked"].includes(item.code);
      const v2 = createImportIssue({
        domain: "teacher",
        issueType: item.code,
        scope: "row",
        rowRefs: [`T${String(row.sourceRowNumber).padStart(3, "0")}`],
        fieldKey: item.field || null,
        severity: blocking ? "blocking" : "warning",
        sourceValues: item.value ? [item.value] : [],
        explanation: item.message,
        recommendedAction: blocking ? "Provide or select a valid value before confirming this row." : "Review the suggested interpretation before confirming this row.",
        resolutionClass: blocking ? "BLOCKING" : "REVIEW",
        requiresHumanConfirmation: true,
      });
      analysisIssueMap.set(v2.issueId, v2);
    }
  }
  const groupedSubjectReviews = new Map<string, {
    issueType: string;
    sourceValue: string;
    gradeBand: string | null;
    gradeIds: string[];
    candidateOfferingIds: string[];
    rowNumbers: number[];
  }>();
  for (const resolution of subjectResolutions.filter((item) => item.status === "needs_review" && item.resolutionClass === "REVIEW")) {
    const affectedRows = rows.filter((row) => resolution.affectedRows.includes(row.sourceRowNumber));
    const sourceKey = normalizeTeacherImportLookup(resolution.sourceValue);
    const hasSemanticSuggestion = affectedRows.some((row) => row.issues.some((item) => item.code === "semantic_substitution_review" && item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === sourceKey));
    const hasUnresolvedSubject = affectedRows.some((row) => row.issues.some((item) => item.code === "subject_review" && item.field === "subjects" && normalizeTeacherImportLookup(item.value || "") === sourceKey));
    if (!hasSemanticSuggestion && !hasUnresolvedSubject) continue;
    const gradeIds = unique((resolution.contextGradeIds || []).filter(Boolean), String).sort();
    const gradeBands = unique(
      gradeIds.map((gradeId) => understandingGradeById.get(gradeId)).filter((grade): grade is TeacherUnderstandingGrade => Boolean(grade)).map(gradeBandForGrade),
      (value) => value || "unscoped"
    ).sort();
    const gradeBand = gradeBands.length === 1 ? gradeBands[0] : gradeBands.join(",") || null;
    const candidateOfferingIds = unique((resolution.candidateOptions || []).map((candidate) => candidate.id), String).sort();
    const issueType = hasSemanticSuggestion ? "semantic_substitution_review" : "subject_unresolved";
    // Candidate set and grade band are both part of the grouping boundary: a
    // decision for lower-primary History must never spill into upper primary.
    const groupKey = [issueType, sourceKey, gradeBand || "unscoped", candidateOfferingIds.join(",")].join("::");
    const existingGroup = groupedSubjectReviews.get(groupKey) || {
      issueType,
      sourceValue: resolution.sourceValue,
      gradeBand,
      gradeIds: [],
      candidateOfferingIds,
      rowNumbers: [],
    };
    existingGroup.gradeIds = unique([...existingGroup.gradeIds, ...gradeIds], String).sort();
    existingGroup.rowNumbers = unique([...existingGroup.rowNumbers, ...resolution.affectedRows], String).sort((left, right) => left - right);
    groupedSubjectReviews.set(groupKey, existingGroup);
  }
  for (const group of groupedSubjectReviews.values()) {
    const rowRefs = group.rowNumbers.map((rowNumber) => `T${String(rowNumber).padStart(3, "0")}` as ImportRowReference);
    const groupedIssue = createImportIssue({
      domain: "teacher",
      issueType: group.issueType,
      scope: "group",
      rowRefs,
      fieldKey: "subjects",
      severity: "warning",
      sourceValues: [group.sourceValue],
      explanation: group.issueType === "semantic_substitution_review"
        ? `Leo suggested a semantic alternative for "${group.sourceValue}". Confirm a compatible offering for the ${group.gradeBand || "resolved"} context, or ignore the source subject.`
        : `"${group.sourceValue}" has no unique active offering for the ${group.gradeBand || "resolved"} context. Choose a compatible offering, accept a validated Leo recommendation, or ignore it.`,
      recommendedAction: "Choose one compatible offering for these rows, or explicitly ignore the source subject.",
      resolutionClass: "REVIEW",
      requiresHumanConfirmation: true,
      context: {
        gradeBand: group.gradeBand,
        gradeIds: group.gradeIds,
        candidateOfferingIds: group.candidateOfferingIds,
      },
      affectedCount: group.rowNumbers.length,
    });
    analysisIssueMap.set(groupedIssue.issueId, groupedIssue);
    const sourceKey = normalizeTeacherImportLookup(group.sourceValue);
    for (const row of rows.filter((item) => group.rowNumbers.includes(item.sourceRowNumber))) {
      row.issues = row.issues.map((item) => (
        item.field === "subjects" &&
        ["subject_review", "semantic_substitution_review"].includes(item.code) &&
        normalizeTeacherImportLookup(item.value || "") === sourceKey
          ? { ...item, groupedIssueId: groupedIssue.issueId }
          : item
      ));
      if (!(row.provenance || []).some((item) => item.field === "subjects" && item.note === `Review group: ${groupedIssue.issueId}`)) {
        row.provenance = [
          ...(row.provenance || []),
          provenance({
            field: "subjects",
            sourceValue: group.sourceValue,
            source: "inferred",
            note: `Review group: ${groupedIssue.issueId}`,
          }),
        ];
      }
    }
  }
  for (const previous of input.preserved?.analysisIssues || []) {
    if (previous.status !== "resolved" || !["admin", "admin_via_leo", "admin_apply_similar"].includes(previous.resolvedBy || "")) continue;
    const current = analysisIssueMap.get(previous.issueId);
    if (current) analysisIssueMap.set(previous.issueId, { ...current, status: "resolved", resolvedAction: previous.resolvedAction || null, resolvedBy: previous.resolvedBy, updatedAt: new Date().toISOString() });
  }
  const subjectLabelsById = new Map<string, string>();
  for (const resolution of subjectResolutions) {
    resolution.subjectOfferingIds.forEach((offeringId, index) => subjectLabelsById.set(String(offeringId), resolution.resolvedNames[index] || resolution.sourceValue));
  }
  const attentionSignals = detectTeacherAttentionSignals({ rows, subjectLabelsById });
  for (const signal of attentionSignals) {
    if (!["possible_primary_class_teacher_pattern", "cross_stage_subject_profile", "assignment_subject_profile_gap", "possible_duplicate_subject_profile", "unusual_class_load", "homeroom_conflict"].includes(signal.type)) continue;
    const existing = [...analysisIssueMap.values()].find((candidate) => candidate.status === "open" && candidate.rowRefs.includes(signal.rowRef as ImportRowReference));
    if (existing) {
      if (signal.type === "possible_primary_class_teacher_pattern" || signal.type === "subjects_without_teaching_context") {
        existing.explanation = `${existing.explanation} ${signal.explanation}`;
        existing.recommendedAction = "Review the complete teacher relationship picture with Leo before continuing.";
      }
      continue;
    }
    const attentionIssue = attentionIssueForSignal(signal);
    const previous = input.preserved?.analysisIssues?.find((candidate) => candidate.issueId === attentionIssue.issueId);
    const sameConfirmedPattern = previous?.context?.similarityKey === attentionIssue.context?.similarityKey;
    if (sameConfirmedPattern && previous?.status === "resolved" && ["admin", "admin_via_leo", "admin_apply_similar"].includes(previous.resolvedBy || "")) {
      analysisIssueMap.set(attentionIssue.issueId, { ...attentionIssue, status: "resolved", resolvedAction: previous.resolvedAction || null, resolvedBy: previous.resolvedBy, updatedAt: new Date().toISOString() });
      continue;
    }
    analysisIssueMap.set(attentionIssue.issueId, attentionIssue);
    const target = rows.find((row) => (row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`) === signal.rowRef);
    if (target && target.resolutionStatus === "resolved") {
      target.resolutionStatus = "needs_review";
      target.rowState = "pending";
      target.issues.push({ code: attentionIssue.issueType, message: signal.explanation, field: "teacherRelationships", value: signal.label, affectedRows: [target.sourceRowNumber], groupedIssueId: attentionIssue.issueId });
    }
  }
  for (const [classGroupId, affected] of homeroomRows) {
    if (affected.length < 2) continue;
    const v2 = createImportIssue({
      domain: "teacher",
      issueType: "duplicate_homeroom",
      scope: "group",
      rowRefs: affected.map((row) => `T${String(row.sourceRowNumber).padStart(3, "0")}` as ImportRowReference),
      fieldKey: "homeroomClassGroupId",
      severity: "warning",
      sourceValues: [classGroupId],
      explanation: "More than one imported teacher claims the same homeroom. Choose one homeroom teacher; teaching subjects remain separate.",
      recommendedAction: "Keep one homeroom assignment or remove the homeroom from the other rows.",
      resolutionClass: "REVIEW",
      requiresHumanConfirmation: true,
    });
    analysisIssueMap.set(v2.issueId, v2);
  }
  const analysisSummary: ITeacherImportAnalysisSummary = {
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.rowState === "ready").length,
    needsReviewRows: rows.filter((row) => row.resolutionStatus === "needs_review").length,
    blockedRows: rows.filter((row) => row.resolutionStatus === "blocked").length,
    existingRows: rows.filter((row) => row.rowState === "existing").length,
    mappedColumns: parsed.columnMappings.filter((mapping) => mapping.canonicalField).length,
    resolvedSubjectAliases: subjectResolutions.filter((item) => item.status === "resolved" && item.source !== "exact").length,
    resolvedClassAliases: classResolutions.filter((item) => item.status === "resolved").length,
    warnings: analysisWarnings.length,
    errors: analysisErrors.length,
    leoUsed,
    leoUnavailable,
    autoResolutionCount: subjectResolutions.filter((item) => item.status === "resolved").length + classResolutions.filter((item) => item.status === "resolved").length,
    reviewCount: rows.filter((row) => row.resolutionStatus === "needs_review").length,
    blockedCount: rows.filter((row) => row.resolutionStatus === "blocked").length,
    conflictCount: rows.reduce((count, row) => count + row.issues.filter((item) => ["duplicate_homeroom", "assignment_overlap", "duplicate_explicit_assignment", "duplicate_source_teacher", "occupied_homeroom"].includes(item.code)).length, 0),
    leoAssistedCount: parsed.columnMappings.filter((mapping) => mapping.source === "leo").length + subjectResolutions.filter((item) => item.source === "leo").length,
    reviewIssues: [...analysisIssueMap.values()].filter((item) => item.status === "open" && item.resolutionClass === "REVIEW").length,
    groupedReviewIssues: [...analysisIssueMap.values()].filter((item) => item.status === "open" && item.scope === "group" && item.resolutionClass === "REVIEW").length,
    blockingIssues: [...analysisIssueMap.values()].filter((item) => item.status === "open" && item.resolutionClass === "BLOCKING").length,
  };

  return {
    selectedSheetName: parsed.selectedSheetName,
    availableSheets: parsed.sheets.map((sheet) => ({ name: sheet.name, score: sheet.score, rowCount: sheet.rows.length, signals: sheet.signals })),
    sheetSelectionRequired: parsed.sheetSelectionRequired,
    columnMappings: parsed.columnMappings,
    parsedRows: rows,
    subjectResolutions,
    classResolutions,
    analysisSummary,
    analysisWarnings,
    analysisErrors,
    leoAnalysis,
    analysisIssues: [...analysisIssueMap.values()],
      columnInterpretations: parsed.columnMappings.map((mapping) => ({
      sourceColumn: mapping.sourceHeader,
      sourceColumnKey: normalizeTeacherUnderstanding(mapping.sourceHeader),
      proposedCanonicalField: mapping.canonicalField,
      source: mapping.source === "exact" ? "exact" : mapping.source === "alias" ? "deterministic_alias" : mapping.source === "structural" ? "structural" : mapping.source === "leo" ? "leo" : "admin",
      confidenceBand: mapping.confidence >= 0.9 ? "high" : mapping.confidence >= 0.7 ? "medium" : "low",
      requiresConfirmation: mapping.status !== "resolved" || mapping.confidence < 0.9,
      explanation: headerRationaleByHeader.get(mapping.sourceHeader) || (mapping.canonicalField ? `Interpreted as ${mapping.canonicalField}.` : "The column meaning remains unresolved."),
      contributesTo: mapping.canonicalField === "subjects" ? ["subjects"] : mapping.canonicalField === "gradeScopes" ? ["gradeScopes"] : mapping.canonicalField === "classScopes" ? ["classScopes"] : undefined,
      transformation: mapping.canonicalField === "fullName" ? "split_name" : ["subjects", "gradeScopes", "classScopes"].includes(mapping.canonicalField || "") ? "expand_list" : "normalize_value",
    })),
  };
}
