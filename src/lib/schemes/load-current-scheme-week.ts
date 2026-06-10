import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import {
  resolveCurrentSchoolSchemeWeek,
  type SchoolSchemeWeekSnapshot,
} from "@/lib/schemes/resolve-scheme-week";

export async function loadCurrentSchemeWeekForSchool(
  schoolId: mongoose.Types.ObjectId | string,
  options?: { academicPeriodId?: mongoose.Types.ObjectId | string | null }
): Promise<SchoolSchemeWeekSnapshot> {
  const schoolOid =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  let periodQuery: Record<string, unknown> = { schoolId: schoolOid };
  if (options?.academicPeriodId) {
    periodQuery = {
      _id:
        options.academicPeriodId instanceof mongoose.Types.ObjectId
          ? options.academicPeriodId
          : new mongoose.Types.ObjectId(String(options.academicPeriodId)),
      schoolId: schoolOid,
    };
  } else {
    periodQuery.isCurrent = true;
  }

  const period = await AcademicPeriod.findOne(periodQuery)
    .select("_id yearLabel term startDate endDate")
    .lean<{
      _id: mongoose.Types.ObjectId;
      yearLabel: string;
      term: string;
      startDate: Date;
      endDate: Date;
    } | null>();

  if (!period) {
    return resolveCurrentSchoolSchemeWeek({ period: null });
  }

  return resolveCurrentSchoolSchemeWeek({
    period: { startDate: period.startDate, endDate: period.endDate },
    academicPeriodId: String(period._id),
    academicPeriodLabel: `${period.yearLabel} • ${period.term}`,
  });
}
