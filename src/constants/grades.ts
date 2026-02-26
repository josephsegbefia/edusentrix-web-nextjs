// src/constants/grades.ts

export type GradesSortBy =
  | "name"
  | "code"
  | "stage"
  | "classCount"
  | "studentCount"
  | "order";

export type GradesSortOrder = "asc" | "desc";

export const DEFAULT_GRADES_PAGE_SIZE = 25;
export const GRADES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
