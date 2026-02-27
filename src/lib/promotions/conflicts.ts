// src/lib/promotions/conflicts.ts
// PROMO-BE-003: Conflict detection per PROMOTION_SERVICE_SPEC §10.3

export type ConflictCode =
  | "NO_TARGET_GRADE_MAPPING"
  | "NO_CLASSGROUP_TARGET_GRADE"
  | "NO_CAPACITY_TARGET_GRADE"
  | "CLASSGROUP_INACTIVE"
  | "STUDENT_NOT_ACTIVE"
  | "STUDENT_WITHDRAWN"
  | "MISSING_ACADEMIC_EVIDENCE"
  | "MISSING_ATTENDANCE_EVIDENCE"
  | "MISSING_FINANCE_EVIDENCE"
  | "MISSING_DISCIPLINE_EVIDENCE"
  | "POLICY_REQUIRED_CRITERIA_FAILED"
  | "POLICY_SCORE_BELOW_THRESHOLD"
  | "POLICY_CONFLICT"
  | "PLACEMENT_OVERRIDE_REQUIRED"
  | "CONCURRENCY_CONFLICT"
  | "INTERNAL_ERROR";

export function addConflict(conflicts: string[], code: ConflictCode): void {
  if (!conflicts.includes(code)) conflicts.push(code);
}

export function hasConflict(conflicts: string[], code: ConflictCode): boolean {
  return conflicts.includes(code);
}
