import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { AcademicPeriod, IAcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

export async function GET() {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  // Ensure schoolId is properly converted to ObjectId
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const [studentsTotal, teachersTotal, subjectsTotal] = await Promise.all([
    Student.countDocuments({ schoolId: schoolIdObj }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
    Subject.countDocuments({ schoolId: schoolIdObj }),
  ]);

  const periodRaw = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("yearLabel term startDate endDate isCurrent")
    .lean();
  const periodNormalized = Array.isArray(periodRaw) ? periodRaw[0] : periodRaw;
  const period = periodNormalized as Pick<
    IAcademicPeriod,
    "yearLabel" | "term" | "startDate" | "endDate"
  > | null;

  // TODO => when Payment/Invoice models arrive
  const revenueCurrent = 0;
  const revenueTrend = { deltaPct: 0, direction: "flat" as const };

  const studentsTrend = { deltaPct: 0, direction: "flat" as const };
  const teachersTrend = { deltaPct: 0, direction: "flat" as const };
  const subjectsTrend = { deltaPct: 0, direction: "flat" as const };

  return NextResponse.json({
    students: { total: studentsTotal, trend: studentsTrend },
    teachers: { total: teachersTotal, trend: teachersTrend },
    subjects: { total: subjectsTotal, trend: subjectsTrend },
    revenue: { current: revenueCurrent, trend: revenueTrend },
    period: period
      ? {
          yearLabel: period.yearLabel,
          term: period.term,
          startDate: period.startDate,
          endDate: period.endDate,
        }
      : null,
    collections: { collected: 0, outstanding: 0, rate: 0 },
  });
}
