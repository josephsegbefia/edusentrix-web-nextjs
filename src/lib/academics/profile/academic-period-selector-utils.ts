import type { AcademicPeriodProfileStatus } from "@/types/academics/student-academic-profile";
import type { AcademicProfilePeriodDTO } from "@/types/academics/student-academic-profile";
import type { StudentTermOverview } from "@/types/admin/student-academics";

export const PERIOD_STATUS_LABELS: Record<AcademicPeriodProfileStatus, string> = {
  no_data: "No data",
  in_progress: "In progress",
  compiled: "Compiled",
  approved: "Approved",
  released: "Released",
  legacy: "Legacy",
};

export function mapTermOverviewToPeriodItem(
  term: StudentTermOverview
): AcademicProfilePeriodDTO {
  return {
    academicPeriodId: term.termId,
    label: term.label,
    startDate: "",
    endDate: "",
    isCurrent: false,
    status: term.averageScore != null ? "legacy" : "no_data",
    hasReportCard: false,
    isOfficial: false,
  };
}

export function resolvePeriodOptions(input: {
  profilePeriods?: AcademicProfilePeriodDTO[];
  legacyTerms?: StudentTermOverview[];
}): AcademicProfilePeriodDTO[] {
  if (input.profilePeriods?.length) {
    return input.profilePeriods;
  }
  return (input.legacyTerms ?? []).map(mapTermOverviewToPeriodItem);
}

export function readPeriodIdFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): string | null {
  return searchParams.get("periodId") ?? searchParams.get("termId");
}

export function writePeriodIdToSearchParams(
  params: URLSearchParams,
  periodId: string
) {
  params.set("termId", periodId);
  params.set("periodId", periodId);
}
