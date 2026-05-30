import {
  readSnapshotNumber,
  readSnapshotString,
} from "@/lib/academics/profile/snapshot-field-utils";
import type { IStudentReportCard } from "@/models/StudentReportCard";
import type {
  AcademicProfileSubjectHistoryPointDTO,
  AcademicProfileTermHistoryPointDTO,
  AcademicTermHistorySource,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";

function sortByPeriodOrder<T extends { academicPeriodId: string }>(
  rows: T[],
  periodOrder: string[]
) {
  const orderIndex = new Map(periodOrder.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => {
    const aIndex = orderIndex.get(a.academicPeriodId) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.get(b.academicPeriodId) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

function upsertTermPoint(
  map: Map<string, AcademicProfileTermHistoryPointDTO>,
  point: AcademicProfileTermHistoryPointDTO,
  preferOfficial = false
) {
  const existing = map.get(point.academicPeriodId);
  if (!existing) {
    map.set(point.academicPeriodId, point);
    return;
  }
  if (preferOfficial && point.isOfficial) {
    map.set(point.academicPeriodId, point);
  }
}

export function hydrateAcademicProfileTrends(input: {
  profile: StudentAcademicProfileDTO;
  releasedCards: IStudentReportCard[];
  periodOrder: string[];
  periodLabelById: Map<string, string>;
}): void {
  const { profile, releasedCards, periodOrder, periodLabelById } = input;
  const termByPeriod = new Map<string, AcademicProfileTermHistoryPointDTO>();
  const subjectHistory: Record<string, AcademicProfileSubjectHistoryPointDTO[]> = {
    ...profile.trends.subjectHistory,
  };

  for (const card of releasedCards) {
    const periodId = String(card.academicPeriodId);
    const label = periodLabelById.get(periodId) ?? periodId;
    const termSummary = card.termSummarySnapshot as Record<string, unknown> | undefined;

    upsertTermPoint(
      termByPeriod,
      {
        academicPeriodId: periodId,
        label,
        averageScore: readSnapshotNumber(termSummary?.averageFinalScore, null),
        classPosition: readSnapshotNumber(termSummary?.classPosition, null),
        classAverage: null,
        source: "official_released",
        isOfficial: true,
      },
      true
    );

    const snapshotRows = Array.isArray(card.subjectResultsSnapshot)
      ? (card.subjectResultsSnapshot as Array<Record<string, unknown>>)
      : [];

    for (const row of snapshotRows) {
      const subjectId = readSnapshotString(row.subjectId);
      if (!subjectId) continue;

      const history = subjectHistory[subjectId] ?? [];
      if (history.some((entry) => entry.academicPeriodId === periodId)) {
        continue;
      }

      history.push({
        academicPeriodId: periodId,
        periodLabel: label,
        roundedFinalScore: readSnapshotNumber(
          row.roundedFinalScore,
          readSnapshotNumber(row.finalScore, null)
        ),
        gradeLabel: readSnapshotString(row.gradeLabel),
        source: "official_released",
      });
      subjectHistory[subjectId] = history;
    }
  }

  for (const point of profile.trends.termHistory) {
    upsertTermPoint(termByPeriod, point, point.isOfficial);
  }

  const selectedPeriodId = profile.selectedPeriod.academicPeriodId;
  if (
    selectedPeriodId &&
    profile.permissions.canViewProjectedAverage &&
    !profile.reportStatus.isReleased
  ) {
    const projected =
      profile.summary.projectedAverage ?? profile.summary.overallAverage;
    if (projected != null) {
      upsertTermPoint(termByPeriod, {
        academicPeriodId: selectedPeriodId,
        label: profile.selectedPeriod.label ?? selectedPeriodId,
        averageScore: projected,
        classPosition: profile.summary.classPosition,
        classAverage: null,
        source: "projected_current",
        isOfficial: false,
      });
    }
  }

  if (selectedPeriodId && profile.subjectResults.length > 0) {
    const periodLabel = profile.selectedPeriod.label ?? selectedPeriodId;
    const subjectSource: AcademicTermHistorySource =
      profile.dataSource === "legacy"
        ? "legacy_fallback"
        : profile.reportStatus.isReleased
          ? "official_released"
          : "projected_current";

    for (const row of profile.subjectResults) {
      if (row.roundedFinalScore == null && row.finalScore == null) {
        continue;
      }

      const history = subjectHistory[row.subjectId] ?? [];
      const existingIndex = history.findIndex(
        (entry) => entry.academicPeriodId === selectedPeriodId
      );
      const point: AcademicProfileSubjectHistoryPointDTO = {
        academicPeriodId: selectedPeriodId,
        periodLabel,
        roundedFinalScore: row.roundedFinalScore ?? row.finalScore,
        gradeLabel: row.gradeLabel,
        source: row.isOfficial ? "official_released" : subjectSource,
      };

      if (existingIndex >= 0) {
        if (point.source === "official_released") {
          history[existingIndex] = point;
        }
      } else {
        history.push(point);
      }
      subjectHistory[row.subjectId] = history;
    }
  }

  profile.trends.termHistory = sortByPeriodOrder(
    Array.from(termByPeriod.values()),
    periodOrder
  );

  for (const subjectId of Object.keys(subjectHistory)) {
    subjectHistory[subjectId] = [...subjectHistory[subjectId]!].sort((a, b) => {
      const aIndex = periodOrder.indexOf(a.academicPeriodId);
      const bIndex = periodOrder.indexOf(b.academicPeriodId);
      return aIndex - bIndex;
    });
  }

  profile.trends.subjectHistory = subjectHistory;
}
