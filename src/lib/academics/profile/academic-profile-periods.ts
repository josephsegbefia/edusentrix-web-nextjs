import mongoose from "mongoose";
import { AcademicPeriod, type IAcademicPeriod } from "@/models/AcademicPeriod";
import type {
  AcademicPeriodProfileStatus,
  AcademicProfilePeriodDTO,
} from "@/types/academics/student-academic-profile";

export type IdLike = string | mongoose.Types.ObjectId;

export function toStringId(id: IdLike | undefined | null): string | null {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id.toString() : String(id);
}

export function formatAcademicPeriodLabel(
  period: Pick<IAcademicPeriod, "yearLabel" | "term">
): string {
  return `${period.yearLabel} • ${period.term}`;
}

export function toIsoDateString(value: Date | string | undefined | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function loadSchoolAcademicPeriods(schoolId: string) {
  const periods = (await AcademicPeriod.find({ schoolId })
    .sort({ startDate: 1 })
    .lean()) as unknown as IAcademicPeriod[];

  const periodMap = new Map<string, IAcademicPeriod>();
  for (const period of periods) {
    periodMap.set(period._id.toString(), period);
  }

  return { periods, periodMap };
}

export async function resolveSelectedAcademicPeriod(input: {
  schoolId: string;
  academicPeriodId?: string | null;
  periodMap: Map<string, IAcademicPeriod>;
  allPeriods: IAcademicPeriod[];
}): Promise<IAcademicPeriod | null> {
  const { schoolId, academicPeriodId, periodMap, allPeriods } = input;

  if (academicPeriodId) {
    const pid = toStringId(academicPeriodId);
    if (pid) {
      const fromMap = periodMap.get(pid);
      if (fromMap) return fromMap;

      const direct = (await AcademicPeriod.findOne({
        schoolId,
        _id: pid,
      }).lean()) as unknown as IAcademicPeriod | null;

      if (direct) {
        periodMap.set(direct._id.toString(), direct);
        return direct;
      }
    }
  }

  if (allPeriods.length === 0) {
    return null;
  }

  const current = (await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  }).lean()) as unknown as IAcademicPeriod | null;

  if (current) {
    return current;
  }

  const sortedByEnd = [...allPeriods].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );
  return sortedByEnd[sortedByEnd.length - 1] ?? null;
}

export function buildAcademicProfilePeriodDTO(
  period: IAcademicPeriod,
  input: {
    releasedPeriodIds: Set<string>;
    currentPeriodId: string | null;
  }
): AcademicProfilePeriodDTO {
  const periodId = period._id.toString();
  const hasReportCard = input.releasedPeriodIds.has(periodId);
  const isCurrent = input.currentPeriodId === periodId;

  let status: AcademicPeriodProfileStatus = "no_data";
  if (hasReportCard) {
    status = "released";
  } else if (isCurrent) {
    status = "in_progress";
  }

  return {
    academicPeriodId: periodId,
    label: formatAcademicPeriodLabel(period),
    startDate: toIsoDateString(period.startDate),
    endDate: toIsoDateString(period.endDate),
    isCurrent,
    status,
    hasReportCard,
    isOfficial: hasReportCard,
  };
}
