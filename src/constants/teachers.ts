// src/constants/teachers.ts
import type { ReadonlyURLSearchParams } from "next/navigation";

export const DEFAULT_TEACHERS_PAGE_SIZE = 25;

export const TEACHERS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "on_leave", label: "On Leave" },
  { id: "terminated", label: "Terminated" },
  { id: "homeroom", label: "Homeroom" },
] as const;

export type TeachersTabId = (typeof TEACHERS_TABS)[number]["id"];

export const TEACHERS_VIEW_MODES = ["table", "cards"] as const;
export type TeachersViewMode = (typeof TEACHERS_VIEW_MODES)[number];

export const TEACHERS_SORT_BY = [
  "name",
  "createdAt",
  "status",
  "hireDate",
] as const;
export type TeachersSortBy = (typeof TEACHERS_SORT_BY)[number];

export type TeachersSortOrder = "asc" | "desc";

export function getInitialTeacherTab(
  sp: ReadonlyURLSearchParams
): TeachersTabId {
  const raw = (sp.get("tab") || "all").trim() as TeachersTabId;
  return TEACHERS_TABS.some((t) => t.id === raw) ? raw : "all";
}

export function getInitialTeacherView(
  sp: ReadonlyURLSearchParams
): TeachersViewMode {
  const raw = (sp.get("view") || "table").trim() as TeachersViewMode;
  return TEACHERS_VIEW_MODES.includes(raw) ? raw : "table";
}
