import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
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
  type TeacherImportRow,
} from "@/lib/teachers/parse-teacher-import";
import { suggestTeacherImportSemantics } from "@/lib/teachers/teacher-import-leo";

type IdLike = mongoose.Types.ObjectId | string;

type GradeRecord = { _id: IdLike; name: string };
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
};

export type TeacherImportAnalysisResult = Pick<ITeacherImportJob, "selectedSheetName" | "columnMappings" | "parsedRows" | "subjectResolutions" | "classResolutions" | "analysisSummary" | "analysisWarnings" | "analysisErrors">;

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

function unique<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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
    : { value: clean(value), status: "needs_review" as const };
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
  if (issues.some((item) => ["blocked", "missing_required", "invalid", "duplicate"].includes(item.code))) return "blocked";
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
  const candidates = [
    grade && source ? `${grade} ${source}` : "",
    source,
    source.replace(/\s+/g, ""),
  ].filter(Boolean);
  const matches = candidates.flatMap((candidate) => classMap.get(normalizeTeacherImportLookup(candidate)) || []);
  return dedupeTeacherImportClassMatches(matches);
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
  const direct = offerings.filter((offering) => offeringAliases(offering).includes(normalized));
  const contextual = classGroup
    ? direct.filter((offering) => (offering.gradeIds || []).some((id) => objectIdString(id) === objectIdString(classGroup.gradeId)))
    : direct;
  if (contextual.length === 1) return { status: "resolved" as const, candidates: contextual, source: "exact" as const, note: "Matched the school's active subject offering." };
  if (direct.length === 1) return { status: "resolved" as const, candidates: direct, source: "alias" as const, note: "Matched a normalized subject offering alias." };

  const family = subjectFamilyForToken(token);
  let familyMatches = offerings.filter((offering) => normalizeTeacherImportLookup(offering.subjectFamily || "") === family);
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
}): Promise<TeacherImportAnalysisResult> {
  const parsed = parseTeacherImportWorkbook(input.fileBytes, input.fileName);
  const [offerings, grades, classes] = await Promise.all([
    SubjectOffering.find({ schoolId: input.schoolId, isActive: true })
      .select("_id subjectId displayName shortName code subjectFamily gradeIds gradeBand stage")
      .lean<OfferingRecord[]>(),
    Grade.find({ schoolId: input.schoolId, isActive: true }).select("_id name").lean<GradeRecord[]>(),
    ClassGroup.find({ schoolId: input.schoolId, isActive: true })
      .select("_id name gradeId homeroomTeacherId subjectOfferingIds")
      .lean<ClassRecord[]>(),
  ]);
  const gradeNames = new Map(grades.map((grade) => [objectIdString(grade._id), grade.name]));
  const classMap = lookupClasses(classes, gradeNames);
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
  const seenEmployeeIds = new Map<string, number>();

  for (const sourceRow of parsed.rows) {
    const issues: ITeacherImportIssue[] = [];
    const status = statusValue(sourceRow.status);
    const currentRowClassMatches = findClassMatches(sourceRow, classes, gradeNames, classMap);
    const classGroup = currentRowClassMatches.length === 1 ? currentRowClassMatches[0] : null;
    const subjectContextClass = classGroup || (() => {
      const gradeId = matchingGradeId(sourceRow.homeroomGrade, grades);
      return gradeId ? { _id: "grade-context", name: "", gradeId } as ClassRecord : null;
    })();
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
    for (const token of subjectTokens) {
      const resolved = resolveTeacherImportSubjectToken(token, sourceRow, subjectContextClass, offerings);
      const key = `${normalizeTeacherImportLookup(token)}|${subjectContextClass ? objectIdString(subjectContextClass.gradeId) : "none"}`;
      const prior = subjectGroups.get(key);
      const manualCandidates = resolved.candidates.length > 0
        ? resolved.candidates
        : subjectContextClass
          ? offerings.filter((offering) => (offering.gradeIds || []).some((id) => objectIdString(id) === objectIdString(subjectContextClass.gradeId)))
          : offerings;
      const group: ITeacherImportSubjectResolution = prior || {
        sourceValue: token,
        subjectFamily: resolved.candidates[0]?.subjectFamily || subjectFamilyForToken(token),
        subjectOfferingIds: [],
        resolvedNames: [],
        source: resolved.source,
        status: resolved.status,
        affectedRows: [],
        candidateOptions: manualCandidates.map((offering) => ({
          id: objectIdString(offering._id),
          label: offering.displayName,
          gradeBand: offering.gradeBand,
        })),
        note: resolved.note,
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
        issues.push(issue(resolved.status === "blocked" ? "not_found" : "ambiguous", `${resolved.note} Source value: "${token}".`, "subjects", token));
      }
      subjectGroups.set(key, group);
    }

    const normalizedEmail = sourceRow.email.toLowerCase();
    const matchedUser = normalizedEmail ? existing.userByEmail.get(normalizedEmail) : null;
    const matchedTeacher = (matchedUser && teacherByUserId.get(objectIdString(matchedUser._id))) || (sourceRow.employeeId && teacherByEmployeeId.get(normalizeTeacherImportLookup(sourceRow.employeeId))) || null;
    if (matchedTeacher) issues.push(issue("existing", "A teacher already exists for this email or employee ID. The default action is to skip it.", "email", normalizedEmail));

    const statusResult = matchedTeacher ? "resolved" : resolutionStatus(issues.filter((item) => item.code !== "existing"));
    rows.push({
      sourceRowNumber: sourceRow.sourceRowNumber,
      sourceValues: sourceRow.sourceValues,
      firstName: sourceRow.firstName,
      lastName: sourceRow.lastName,
      fullName: sourceRow.fullName,
      email: normalizedEmail,
      phone: sourceRow.phone,
      employeeId: sourceRow.employeeId,
      department: sourceRow.department,
      status: status.value,
      subjects: subjectTokens,
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
    });
  }

  const subjectResolutions = [...subjectGroups.values()].map((group) => ({
    ...group,
    subjectOfferingIds: unique(group.subjectOfferingIds, String),
    resolvedNames: unique(group.resolvedNames, String),
  }));
  const classResolutions = [...classGroups.values()];
  let leoUsed = false;
  let leoUnavailable = false;
  const unresolvedSubjects = unique(
    subjectResolutions.filter((item) => item.status !== "resolved").map((item) => item.sourceValue),
    normalizeTeacherImportLookup
  );
  const unresolvedClasses = unique(
    rows
      .filter((row) => row.issues.some((item) => ["not_found", "ambiguous"].includes(item.code) && item.field === "homeroomClass"))
      .map((row) => [clean(row.homeroomGrade), clean(row.homeroomClass)].filter(Boolean).join(" "))
      .filter(Boolean),
    normalizeTeacherImportLookup
  );
  if (unresolvedSubjects.length || unresolvedClasses.length) {
    const leo = await suggestTeacherImportSemantics({
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
    });
    if (leo.ok) {
      leoUsed = true;
      for (const suggestion of leo.suggestions.subjectSuggestions) {
        for (const resolution of subjectResolutions.filter((item) => normalizeTeacherImportLookup(item.sourceValue) === normalizeTeacherImportLookup(suggestion.sourceValue) && item.status !== "resolved")) {
          const family = normalizeTeacherImportLookup(suggestion.suggestedSubjectFamily || "");
          if (!family) continue;
          const candidates = offerings.filter((offering) => normalizeTeacherImportLookup(offering.subjectFamily || "") === family);
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
  const analysisWarnings = rows.flatMap((row) => row.issues.filter((item) => ["existing", "name_split_review", "occupied_homeroom", "status_review"].includes(item.code)));
  if (leoUnavailable) {
    analysisWarnings.push(issue("leo_unavailable", "Leo assistance unavailable. Deterministic matching completed; review the remaining items manually."));
  }
  const analysisErrors = rows
    .filter((row) => row.rowState !== "existing")
    .flatMap((row) => row.issues.filter((item) => ["blocked", "missing_required", "invalid", "duplicate", "not_found", "ambiguous"].includes(item.code)));
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
  };

  return {
    selectedSheetName: parsed.selectedSheetName,
    columnMappings: parsed.columnMappings,
    parsedRows: rows,
    subjectResolutions,
    classResolutions,
    analysisSummary,
    analysisWarnings,
    analysisErrors,
  };
}
