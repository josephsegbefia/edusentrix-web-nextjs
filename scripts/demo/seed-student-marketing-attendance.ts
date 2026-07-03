import dotenv from "dotenv";
import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ReportCardRun } from "@/models/ReportCardRun";
import { Student } from "@/models/Student";
import { StudentAttendance, type AttendanceStatus } from "@/models/StudentAttendance";
import { StudentReportCard } from "@/models/StudentReportCard";
import { Teacher } from "@/models/Teacher";
import {
  buildStudentReportCardAttendanceSnapshot,
  loadHomeroomAttendanceRecords,
} from "@/lib/academics/reporting/build-attendance-snapshot";

dotenv.config({ path: ".env.local", quiet: true });

const STUDENT_ID = "6a23fd033941d9c3c3ef3c29";

type SeedDay = {
  date: Date;
  status: AttendanceStatus;
  lateMinutes?: number;
  reason?: string;
};

function toObjectId(value: unknown, label: string) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  throw new Error(`Missing or invalid ${label}`);
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isWeekday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDemoSchoolDays(period: {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): SeedDay[] {
  const periodStart = period.startDate ? startOfDay(new Date(period.startDate)) : null;
  const periodEnd = period.endDate ? startOfDay(new Date(period.endDate)) : null;
  const today = startOfDay(new Date());
  const end = periodEnd && periodEnd < today ? periodEnd : today;
  let cursor = periodStart ?? addDays(end, -70);

  const weekdays: Date[] = [];
  while (cursor <= end && weekdays.length < 40) {
    if (isWeekday(cursor)) {
      weekdays.push(new Date(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  const selected = weekdays.slice(0, 38);
  if (selected.length < 20) {
    throw new Error("Not enough weekday dates available in the current academic period");
  }

  return selected.map((date, index) => {
    if (index === 8) {
      return {
        date,
        status: "late",
        lateMinutes: 12,
        reason: "Morning traffic delay",
      };
    }
    if (index === 19) {
      return {
        date,
        status: "absent",
        reason: "Reported unwell by guardian",
      };
    }
    if (index === 31) {
      return {
        date,
        status: "excused",
        reason: "Approved family appointment",
      };
    }
    return { date, status: "present" };
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME || undefined,
  });

  const student = await Student.findById(STUDENT_ID)
    .select("_id schoolId classGroupId")
    .lean();
  if (!student) throw new Error("Student not found");

  const schoolId = toObjectId(student.schoolId, "student.schoolId");
  const studentId = toObjectId(student._id, "student._id");
  const classGroupId = toObjectId(student.classGroupId, "student.classGroupId");

  const academicPeriod = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("_id yearLabel term startDate endDate")
    .lean();
  if (!academicPeriod) throw new Error("No current academic period found");
  const academicPeriodId = toObjectId(academicPeriod._id, "academicPeriod._id");

  const recorder = await Teacher.findOne({
    schoolId,
    status: "active",
    userId: { $exists: true, $ne: null },
  })
    .select("_id userId")
    .lean();
  const recordedBy = toObjectId(recorder?.userId, "active teacher userId");

  const days = buildDemoSchoolDays(academicPeriod);

  if (!dryRun) {
    for (const day of days) {
      await StudentAttendance.findOneAndUpdate(
        {
          studentId,
          date: day.date,
          type: "homeroom",
        },
        {
          $set: {
            schoolId,
            classGroupId,
            academicPeriodId,
            status: day.status,
            lateMinutes: day.status === "late" ? day.lateMinutes ?? 0 : undefined,
            reason: day.reason ?? undefined,
            notificationSent: false,
            recordedBy,
          },
          $setOnInsert: {
            studentId,
            date: day.date,
            type: "homeroom",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const reportCard = await StudentReportCard.findOne({
      schoolId,
      studentId,
      academicPeriodId,
      status: { $in: ["released", "approved", "compiled"] },
    })
      .sort({ releasedAt: -1, updatedAt: -1 })
      .select("_id reportCardRunId")
      .lean();

    const reportCardRunId =
      reportCard?.reportCardRunId ??
      (
        await ReportCardRun.findOne({
          schoolId,
          academicPeriodId,
          classGroupId,
          status: { $in: ["released", "approved", "compiled"] },
        })
          .sort({ updatedAt: -1 })
          .select("_id")
          .lean()
      )?._id;

    if (reportCardRunId && reportCard) {
      const attendanceSnapshot = await buildStudentReportCardAttendanceSnapshot({
        schoolId,
        academicPeriodId,
        reportCardRunId: toObjectId(reportCardRunId, "reportCardRunId"),
        studentId,
        classGroupId,
      });

      await StudentReportCard.updateOne(
        { _id: reportCard._id },
        { $set: { attendanceSnapshot } }
      );
    }
  }

  const persistedRecords = dryRun
    ? days
    : (
        await loadHomeroomAttendanceRecords({
          schoolId,
          classGroupId,
          academicPeriodId,
          studentId,
        })
      ).map((record) => ({
        date: record.date,
        status: record.status,
      }));

  const counts = persistedRecords.reduce(
    (acc, record) => {
      acc[record.status] += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 } as Record<AttendanceStatus, number>
  );
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const overviewRate =
    total > 0
      ? Math.round(((counts.present + counts.late + counts.excused) / total) * 1000) / 10
      : null;
  const reportRate =
    total > 0 ? Math.round((counts.present / total) * 1000) / 10 : null;

  console.log(
    JSON.stringify(
      {
        dryRun,
        studentId: STUDENT_ID,
        period: `${academicPeriod.yearLabel} ${academicPeriod.term}`,
        dateRange: {
          from: persistedRecords[0]?.date.toISOString().slice(0, 10) ?? null,
          to: persistedRecords[persistedRecords.length - 1]?.date
            .toISOString()
            .slice(0, 10) ?? null,
        },
        counts,
        totalSchoolDays: total,
        overviewAttendanceRate: overviewRate,
        reportSnapshotAttendanceRate: reportRate,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
