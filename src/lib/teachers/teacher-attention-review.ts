import type { ImportIssueV2, ImportRowReference } from "@/lib/import-intelligence/types";
import type { ITeacherImportParsedRow } from "@/models/TeacherImportJob";

export type TeacherAttentionSignalType =
  | "unusually_broad_subject_profile"
  | "subjects_without_teaching_context"
  | "possible_primary_class_teacher_pattern"
  | "cross_stage_subject_profile"
  | "grade_context_without_class_assignment"
  | "assignment_subject_profile_gap"
  | "possible_duplicate_subject_profile"
  | "unusual_class_load"
  | "homeroom_conflict";

export type TeacherAttentionSignal = {
  rowRef: string;
  type: TeacherAttentionSignalType;
  label: string;
  explanation: string;
  gradeBand: string | null;
  similarityKey: string;
};

function rowRef(row: ITeacherImportParsedRow) { return row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`; }
function normal(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }
function stage(value: string) {
  const normalized = normal(value);
  if (/\bjhs\b|junior high/.test(normalized)) return "jhs";
  if (/\b(primary|basic)\b/.test(normalized)) return "primary";
  if (/\b(kg|nursery|creche|preschool)\b/.test(normalized)) return "preschool";
  return "other";
}
function subjectBase(value: string) { return normal(value).replace(/\s*[-/]\s*(lower|upper)?\s*(primary|jhs|preschool)\s*$/i, "").replace(/\s+language$/, ""); }
function gradeBand(row: ITeacherImportParsedRow, subjects: string[]) { return stage([row.homeroomGrade || "", ...row.gradeScopes, ...subjects].join(" ")); }
function hasAssignment(row: ITeacherImportParsedRow) { return row.explicitAssignments.some((assignment) => assignment.status === "resolved"); }

export function detectTeacherAttentionSignals(input: { rows: ITeacherImportParsedRow[]; subjectLabelsById?: Map<string, string> }): TeacherAttentionSignal[] {
  const signals: TeacherAttentionSignal[] = [];
  for (const row of input.rows) {
    const ref = rowRef(row);
    const subjects = row.subjectOfferingIds.map((id) => input.subjectLabelsById?.get(id)).filter((value): value is string => Boolean(value));
    const subjectCount = Math.max(subjects.length, row.subjects.length);
    const assignments = row.explicitAssignments;
    const band = gradeBand(row, subjects);
    const add = (type: TeacherAttentionSignalType, label: string, explanation: string) => signals.push({ rowRef: ref, type, label, explanation, gradeBand: band, similarityKey: `${type}:${band}:${subjectCount}:${Boolean(row.homeroomClassGroupId || row.homeroomClass)}` });

    if (subjectCount >= 5) add("unusually_broad_subject_profile", "Broad subject profile", `This teacher has ${subjectCount} recognised subjects. That may be intentional for a generalist teacher, but the import does not establish how those subjects map to classes.`);
    if (subjectCount > 0 && !row.gradeScopeIds?.length && !row.classScopeIds?.length && !hasAssignment(row)) add("subjects_without_teaching_context", "Subjects without teaching context", "Subjects are present, but the import does not identify a grade, class, or explicit teaching assignment.");
    if (subjectCount >= 5 && Boolean(row.homeroomClassGroupId || row.homeroomClass) && !hasAssignment(row) && band === "primary") add("possible_primary_class_teacher_pattern", "Possible class-teacher pattern", "A broad Primary subject profile plus a homeroom and no explicit assignments may describe a general class teacher responsible for most subjects in that class.");
    const stages = new Set(subjects.map(stage).filter((value) => value !== "other"));
    if (stages.size > 1) add("cross_stage_subject_profile", "Cross-stage subject profile", "The recognised subjects span more than one curriculum stage. This may be legitimate, but the spreadsheet does not clarify whether both are current teaching responsibilities.");
    if (row.gradeScopeIds?.length && !row.classScopeIds?.length && !hasAssignment(row)) add("grade_context_without_class_assignment", "Grade context without class assignment", "The teacher is associated with a grade, but no specific class assignment was provided. No assignment will be inferred automatically.");
    const profileBases = new Set(subjects.map(subjectBase));
    if (profileBases.size < subjects.length) add("possible_duplicate_subject_profile", "Possible duplicate subject", "Two recognised subject entries appear equivalent after removing curriculum-stage wording. Review whether both represent distinct responsibilities.");
    const profileIds = new Set(row.subjectOfferingIds);
    for (const assignment of assignments.filter((item) => item.status === "resolved")) {
      if (assignment.subjectOfferingId && !profileIds.has(assignment.subjectOfferingId)) add("assignment_subject_profile_gap", "Assignment not in subject profile", "An explicit class assignment exists for a subject that is not currently in this teacher's subject profile.");
    }
    if (row.classScopeIds && row.classScopeIds.length > 4) add("unusual_class_load", "Broad class coverage", `This teacher has explicit class context for ${row.classScopeIds.length} classes. That may be valid, but it deserves confirmation.`);
    if (row.issues.some((item) => item.code === "occupied_homeroom" || item.code === "duplicate_homeroom")) add("homeroom_conflict", "Homeroom conflict", "Another homeroom claim or an occupied homeroom requires an explicit administrator decision.");
  }
  return signals;
}

export function attentionIssueForSignal(signal: TeacherAttentionSignal, createdAt = new Date().toISOString()): ImportIssueV2 {
  const rowRefValue = signal.rowRef as ImportRowReference;
  return {
    issueId: `attention_${signal.type}_${signal.rowRef}`,
    domain: "teacher",
    scope: "row",
    rowRefs: [rowRefValue],
    fieldKey: "teacherRelationships",
    issueType: `attention_${signal.type}`,
    severity: "warning",
    sourceValues: [signal.label],
    explanation: signal.explanation,
    recommendedAction: "Review this teacher's relationship context with Leo or use the available manual controls.",
    candidateActions: [],
    resolutionClass: "REVIEW",
    requiresHumanConfirmation: true,
    status: "open",
    context: { gradeBand: signal.gradeBand, similarityKey: signal.similarityKey },
    affectedCount: 1,
    createdAt,
    updatedAt: createdAt,
  };
}
