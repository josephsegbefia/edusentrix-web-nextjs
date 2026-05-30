import type {
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectResultDTO,
} from "@/types/academics/student-academic-profile";

/** Above this count, use compact chips instead of per-component columns. */
export const MAX_SUBJECT_TABLE_COMPONENT_COLUMNS = 4;

export type SubjectResultsTableColumn = {
  componentKey: string;
  label: string;
  weight: number;
};

export type SubjectResultsTableLayout =
  | { mode: "columns"; columns: SubjectResultsTableColumn[] }
  | { mode: "compact" };

export function formatSubjectResultScore(
  value: number | null | undefined,
  suffix = ""
) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}${suffix}`
    : "--";
}

export function formatComponentCellValue(
  component: AcademicProfileScoreComponentDTO | undefined
) {
  if (!component) return "--";
  if (typeof component.weightedScore === "number") {
    return formatSubjectResultScore(component.weightedScore);
  }
  if (typeof component.rawPercentage === "number") {
    return formatSubjectResultScore(component.rawPercentage, "%");
  }
  if (
    typeof component.rawScore === "number" &&
    typeof component.rawMaxScore === "number"
  ) {
    return `${component.rawScore}/${component.rawMaxScore}`;
  }
  return "--";
}

export function resolveSubjectResultsTableLayout(
  subjects: AcademicProfileSubjectResultDTO[]
): SubjectResultsTableLayout {
  const columnMap = new Map<string, SubjectResultsTableColumn>();

  for (const subject of subjects) {
    for (const component of subject.components) {
      const existing = columnMap.get(component.componentKey);
      if (!existing) {
        columnMap.set(component.componentKey, {
          componentKey: component.componentKey,
          label: component.label,
          weight: component.weight,
        });
        continue;
      }
      if (component.weight > existing.weight) {
        columnMap.set(component.componentKey, {
          componentKey: component.componentKey,
          label: component.label,
          weight: component.weight,
        });
      }
    }
  }

  const columns = Array.from(columnMap.values()).sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.label.localeCompare(b.label);
  });

  if (columns.length === 0) {
    return { mode: "compact" };
  }

  if (columns.length > MAX_SUBJECT_TABLE_COMPONENT_COLUMNS) {
    return { mode: "compact" };
  }

  return { mode: "columns", columns };
}

export type SubjectResultStatusBadgeVariant =
  | "official"
  | "provisional"
  | "legacy"
  | "submitted"
  | "returned";

export function resolveSubjectResultStatusBadge(input: {
  row: AcademicProfileSubjectResultDTO;
  periodIsReleased?: boolean;
}): { label: string; variant: SubjectResultStatusBadgeVariant } {
  const { row, periodIsReleased = false } = input;

  if (row.isOfficial || (row.status === "snapshot" && periodIsReleased)) {
    return { label: "Official", variant: "official" };
  }

  if (row.status === "legacy") {
    return { label: "Legacy", variant: "legacy" };
  }

  if (row.status === "approved" || row.status === "locked") {
    return { label: "Approved", variant: "submitted" };
  }

  if (row.status === "submitted") {
    return { label: "Submitted", variant: "submitted" };
  }

  if (row.status === "returned") {
    return { label: "Returned", variant: "returned" };
  }

  if (row.status === "snapshot") {
    return { label: periodIsReleased ? "Official" : "Snapshot", variant: periodIsReleased ? "official" : "provisional" };
  }

  return { label: "Provisional", variant: "provisional" };
}
