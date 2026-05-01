import type { ISchemeItem, SchemeItemCoverageStatus } from "@/models/SchemeItem";

export type CoverageSummary = {
  totalItems: number;
  notStarted: number;
  inProgress: number;
  covered: number;
  skipped: number;
  moved: number;
  needsReview: number;
  coveragePercentage: number;
};

function effectiveCoverageStatus(
  item: Pick<ISchemeItem, "coverageStatus" | "status">
): SchemeItemCoverageStatus {
  if (item.status === "dropped") {
    return "not_started";
  }
  return item.coverageStatus ?? "not_started";
}

/** Counts exclude dropped rows; percentage is covered ÷ planned (non-dropped). */
export function summarizeSchemeItemCoverage(items: ISchemeItem[]): CoverageSummary {
  const planned = items.filter((i) => i.status !== "dropped");
  let notStarted = 0;
  let inProgress = 0;
  let covered = 0;
  let skipped = 0;
  let moved = 0;
  let needsReview = 0;

  for (const item of planned) {
    switch (effectiveCoverageStatus(item)) {
      case "not_started":
        notStarted += 1;
        break;
      case "in_progress":
        inProgress += 1;
        break;
      case "covered":
        covered += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "moved":
        moved += 1;
        break;
      case "needs_review":
        needsReview += 1;
        break;
      default:
        notStarted += 1;
    }
  }

  const totalItems = planned.length;
  const coveragePercentage =
    totalItems === 0 ? 0 : Math.round((100 * covered) / totalItems);

  return {
    totalItems,
    notStarted,
    inProgress,
    covered,
    skipped,
    moved,
    needsReview,
    coveragePercentage,
  };
}
