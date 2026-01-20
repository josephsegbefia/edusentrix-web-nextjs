// src/constants/classes.ts

export const DEFAULT_CLASSES_PAGE_SIZE = 25;
export const CLASSES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type ClassesTabId = "all" | "active" | "inactive";
export type ClassesSortBy = "name" | "grade" | "students" | "subjects" | "teachers" | "createdAt";
export type ClassesSortOrder = "asc" | "desc";

export function getInitialClassesTab(sp: URLSearchParams): ClassesTabId {
  const tab = sp.get("tab");
  if (tab === "active" || tab === "inactive") {
    return tab;
  }
  return "all";
}
