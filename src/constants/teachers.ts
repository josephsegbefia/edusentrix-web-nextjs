export type TeachersTabId = "all" | "active" | "inactive" | "homeroom";

export const TEACHER_TABS: {
  id: TeachersTabId;
  label: string;
  description: string;
}[] = [
  { id: "all", label: "All", description: "Full directory of teachers" },
  { id: "active", label: "Active", description: "Currently active staff" },
  {
    id: "inactive",
    label: "Inactive",
    description: "Not currently active teachers",
  },
  {
    id: "homeroom",
    label: "Homeroom",
    description: "Teachers assigned to homeroom classes",
  },
];

export type TeachersViewMode = "table" | "cards";
export type TeachersSortBy =
  | "name"
  | "email"
  | "createdAt"
  | "status"
  | "homeroom";
export type TeachersSortOrder = "asc" | "desc";

export const DEFAULT_TEACHERS_PAGE_SIZE = 25;
export const TEACHERS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function getInitialTeacherTab(searchParams: {
  get(k: string): string | null;
}): TeachersTabId {
  const t = searchParams.get("tab");
  if (t === "active" || t === "inactive" || t === "homeroom" || t === "all")
    return t;
  return "all";
}

export function getInitialTeacherView(searchParams: {
  get(k: string): string | null;
}): TeachersViewMode {
  const v = searchParams.get("view");
  if (v === "cards" || v === "table") return v;
  return "table";
}
