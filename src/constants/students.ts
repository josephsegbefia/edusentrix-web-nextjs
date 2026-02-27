// src/constants/students.ts

export type StudentsTabId =
  | "all"
  | "by-class"
  | "fee-defaulters"
  | "top-performers"
  | "recent"
  | "alumni";

export const STUDENT_TABS: {
  id: StudentsTabId;
  label: string;
  description: string;
}[] = [
  {
    id: "all",
    label: "All Students",
    description: "Full directory of enrolled students.",
  },
  {
    id: "by-class",
    label: "By Class",
    description: "Browse students grouped by class.",
  },
  {
    id: "fee-defaulters",
    label: "Fee Defaulters",
    description: "Students with outstanding balances.",
  },
  {
    id: "top-performers",
    label: "Top Performers",
    description: "High-achieving students academically.",
  },
  {
    id: "recent",
    label: "Recently Added",
    description: "Students enrolled or added this month.",
  },
  {
    id: "alumni",
    label: "Alumni",
    description: "Graduated students — data preserved for records.",
  },
];

export type StudentsSortBy =
  | "name"
  | "class"
  | "feeStatus"
  | "academic"
  | "enrollmentDate"
  | "createdAt";

export type StudentsSortOrder = "asc" | "desc";

export const DEFAULT_STUDENTS_PAGE_SIZE = 25;
export const STUDENTS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
