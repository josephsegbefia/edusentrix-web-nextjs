import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";

type AttendanceBucket = "habitual_latecomer" | "truant" | "regular" | "watch" | "steady";

function toObjectIdOrNull(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percent(part: number, whole: number, decimals = 1) {
  if (!whole) return 0;
  return round((part / whole) * 100, decimals);
}

function dayKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const classDoc = await ClassGroup.findOne({
      _id: classId,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name")
      .lean();

    if (!classDoc) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const periods = await AcademicPeriod.find({ schoolId: schoolIdObj })
      .sort({ startDate: 1, endDate: 1, createdAt: 1 })
      .lean();

    const { searchParams } = new URL(req.url);
    const requestedPeriodId = toObjectIdOrNull(searchParams.get("academicPeriodId"));
    const selectedPeriod =
      periods.find((period) => String(period._id) === String(requestedPeriodId)) ??
      periods.find((period) => period.isCurrent) ??
      periods[periods.length - 1] ??
      null;

    const selectedPeriodId = selectedPeriod?._id
      ? new mongoose.Types.ObjectId(String(selectedPeriod._id))
      : null;

    const requestedFrom = parseDateParam(searchParams.get("from"));
    const requestedTo = parseDateParam(searchParams.get("to"));

    const defaultFrom = selectedPeriod?.startDate
      ? new Date(selectedPeriod.startDate)
      : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const defaultTo = selectedPeriod?.endDate
      ? new Date(selectedPeriod.endDate)
      : new Date();

    const fromDate = requestedFrom ?? defaultFrom;
    const toDate = requestedTo ?? defaultTo;
    toDate.setHours(23, 59, 59, 999);

    if (fromDate.getTime() > toDate.getTime()) {
      return NextResponse.json(
        { success: false, error: "Start date must be earlier than end date" },
        { status: 400 }
      );
    }

    const students = await Student.find({
      schoolId: schoolIdObj,
      classGroupId: classId,
      status: "active",
    })
      .select("firstName lastName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const gradeName = (classDoc as any).gradeId?.name ?? "Class";
    const classLabel = `${gradeName} ${(classDoc as any).name}`.trim();

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          classGroup: {
            id: String((classDoc as any)._id),
            name: (classDoc as any).name,
            fullLabel: classLabel,
          },
          filters: {
            academicPeriodId: selectedPeriodId ? String(selectedPeriodId) : null,
            academicPeriodLabel: selectedPeriod
              ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
              : null,
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
          summary: {
            studentCount: 0,
            recordedDays: 0,
            totalRecords: 0,
            attendanceRate: 0,
            punctualityRate: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            averageLateMinutes: 0,
            studentsWithNoRecordsCount: 0,
          },
          dailySummary: [],
          students: [],
          segments: {
            habitualLatecomers: [],
            truants: [],
            regularStudents: [],
            attentionNeeded: [],
          },
          leo: {
            riskLevel: "low",
            headline: "No active students in this class yet.",
            summary:
              "Attendance insights will appear here once students are enrolled and homeroom attendance is recorded.",
            insights: [
              "Add active students to this class to start tracking attendance behaviour.",
            ],
            predictions: [],
          },
        },
      });
    }

    const studentIds = students.map((student) => student._id);
    const attendanceQuery: Record<string, unknown> = {
      schoolId: schoolIdObj,
      classGroupId: classId,
      studentId: { $in: studentIds },
      type: "homeroom",
      date: { $gte: fromDate, $lte: toDate },
    };

    if (selectedPeriodId) {
      attendanceQuery.academicPeriodId = selectedPeriodId;
    }

    const attendanceRecords = await StudentAttendance.find(attendanceQuery)
      .select("studentId date status lateMinutes")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const perStudent = new Map<
      string,
      {
        presentCount: number;
        lateCount: number;
        absentCount: number;
        excusedCount: number;
        totalLateMinutes: number;
        records: Array<{ date: string; status: string }>;
      }
    >();
    const daily = new Map<
      string,
      { presentCount: number; lateCount: number; absentCount: number; excusedCount: number }
    >();
    const recordedDays = new Set<string>();

    for (const record of attendanceRecords) {
      const studentKey = String(record.studentId);
      const current =
        perStudent.get(studentKey) ?? {
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
          totalLateMinutes: 0,
          records: [],
        };

      if (record.status === "present") current.presentCount += 1;
      if (record.status === "late") {
        current.lateCount += 1;
        current.totalLateMinutes += Number(record.lateMinutes || 0);
      }
      if (record.status === "absent") current.absentCount += 1;
      if (record.status === "excused") current.excusedCount += 1;
      current.records.push({
        date: dayKey(record.date),
        status: String(record.status),
      });
      perStudent.set(studentKey, current);

      const key = dayKey(record.date);
      const day =
        daily.get(key) ?? {
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
        };

      if (record.status === "present") day.presentCount += 1;
      if (record.status === "late") day.lateCount += 1;
      if (record.status === "absent") day.absentCount += 1;
      if (record.status === "excused") day.excusedCount += 1;
      daily.set(key, day);
      recordedDays.add(key);
    }

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let studentsWithNoRecordsCount = 0;

    const studentRows = students.map((student) => {
      const key = String(student._id);
      const stats = perStudent.get(key) ?? {
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        totalLateMinutes: 0,
        records: [],
      };
      const totalRecords =
        stats.presentCount + stats.lateCount + stats.absentCount + stats.excusedCount;
      const attendedCount = stats.presentCount + stats.lateCount + stats.excusedCount;
      const attendanceRate = totalRecords
        ? percent(attendedCount, totalRecords)
        : 0;
      const punctualityRate = totalRecords
        ? percent(stats.presentCount + stats.excusedCount, totalRecords)
        : 0;
      const averageLateMinutes = stats.lateCount
        ? Math.round(stats.totalLateMinutes / stats.lateCount)
        : 0;

      let bucket: AttendanceBucket = "steady";
      if (totalRecords >= 4 && (stats.absentCount >= 3 || attendanceRate <= 80)) {
        bucket = "truant";
      } else if (stats.lateCount >= 3 || (totalRecords >= 4 && stats.lateCount / totalRecords >= 0.25)) {
        bucket = "habitual_latecomer";
      } else if (totalRecords >= 4 && attendanceRate >= 95 && stats.lateCount <= 1) {
        bucket = "regular";
      } else if (totalRecords >= 3 && (attendanceRate < 90 || stats.lateCount >= 2)) {
        bucket = "watch";
      }

      if (totalRecords === 0) studentsWithNoRecordsCount += 1;

      presentCount += stats.presentCount;
      lateCount += stats.lateCount;
      absentCount += stats.absentCount;
      excusedCount += stats.excusedCount;

      return {
        studentId: key,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo ?? null,
        photoUrl: student.photoUrl ?? null,
        totalRecords,
        presentCount: stats.presentCount,
        lateCount: stats.lateCount,
        absentCount: stats.absentCount,
        excusedCount: stats.excusedCount,
        totalLateMinutes: stats.totalLateMinutes,
        attendanceRate,
        punctualityRate,
        averageLateMinutes,
        recentStatuses: stats.records.slice(-5).reverse(),
        bucket,
      };
    });

    const totalRecords = presentCount + lateCount + absentCount + excusedCount;
    const attendanceRate = percent(presentCount + lateCount + excusedCount, totalRecords);
    const punctualityRate = percent(presentCount + excusedCount, totalRecords);
    const averageLateMinutes = lateCount ? Math.round(
      studentRows.reduce((sum, row) => sum + row.totalLateMinutes, 0) / lateCount
    ) : 0;

    const dailySummary = Array.from(daily.entries())
      .map(([date, counts]) => {
        const dayTotal =
          counts.presentCount + counts.lateCount + counts.absentCount + counts.excusedCount;
        return {
          date,
          ...counts,
          totalRecords: dayTotal,
          attendanceRate: percent(
            counts.presentCount + counts.lateCount + counts.excusedCount,
            dayTotal
          ),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .reverse();

    const bySeverity = [...studentRows];
    const habitualLatecomers = bySeverity
      .filter((row) => row.bucket === "habitual_latecomer")
      .sort((a, b) => b.lateCount - a.lateCount || a.fullName.localeCompare(b.fullName))
      .slice(0, 6);
    const truants = bySeverity
      .filter((row) => row.bucket === "truant")
      .sort(
        (a, b) =>
          b.absentCount - a.absentCount || a.attendanceRate - b.attendanceRate
      )
      .slice(0, 6);
    const regularStudents = bySeverity
      .filter((row) => row.bucket === "regular")
      .sort(
        (a, b) =>
          b.attendanceRate - a.attendanceRate || a.lateCount - b.lateCount
      )
      .slice(0, 6);
    const attentionNeeded = bySeverity
      .filter((row) => row.bucket === "watch" || row.bucket === "truant")
      .sort(
        (a, b) =>
          a.attendanceRate - b.attendanceRate || b.absentCount - a.absentCount
      )
      .slice(0, 8);

    const lateRate = percent(lateCount, totalRecords);
    const absenceRate = percent(absentCount, totalRecords);
    const recentTrendWindow = dailySummary.slice(0, 5);
    const previousTrendWindow = dailySummary.slice(5, 10);
    const recentAverage =
      recentTrendWindow.length > 0
        ? round(
            recentTrendWindow.reduce((sum, day) => sum + day.attendanceRate, 0) /
              recentTrendWindow.length
          )
        : attendanceRate;
    const previousAverage =
      previousTrendWindow.length > 0
        ? round(
            previousTrendWindow.reduce((sum, day) => sum + day.attendanceRate, 0) /
              previousTrendWindow.length
          )
        : recentAverage;

    const leoRiskLevel =
      attendanceRate < 85 || truants.length >= 3 || absenceRate >= 12
        ? "high"
        : attendanceRate < 92 || habitualLatecomers.length >= 3 || lateRate >= 10
        ? "medium"
        : "low";

    const leoHeadline =
      leoRiskLevel === "high"
        ? "Class attendance needs intervention."
        : leoRiskLevel === "medium"
        ? "Attendance is stable, but there are emerging risk signals."
        : "Attendance behaviour is healthy across the class.";

    const leoInsights = [
      `${studentRows.length} active students are in the attendance cohort for ${classLabel}.`,
      `${recordedDays.size} homeroom day${recordedDays.size === 1 ? "" : "s"} have been recorded in the selected window.`,
      truants.length > 0
        ? `${truants.length} student${truants.length === 1 ? "" : "s"} show truant behaviour and should be reviewed.`
        : "No students currently match the truant threshold.",
      habitualLatecomers.length > 0
        ? `${habitualLatecomers.length} student${habitualLatecomers.length === 1 ? "" : "s"} are arriving late consistently.`
        : "Late arrivals are currently under control.",
    ];

    const leoPredictions: string[] = [];
    if (recentAverage + 2 < previousAverage) {
      leoPredictions.push(
        "Recent attendance is trending down versus the prior recorded window. Escalate outreach before the pattern hardens."
      );
    }
    if (habitualLatecomers.length >= 2) {
      leoPredictions.push(
        "If late arrival patterns continue, morning instructional time will keep eroding for the identified students."
      );
    }
    if (truants.length > 0) {
      leoPredictions.push(
        "Current absence levels suggest at least one student is at risk of compounding academic gaps this term."
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        classGroup: {
          id: String((classDoc as any)._id),
          name: (classDoc as any).name,
          fullLabel: classLabel,
        },
        filters: {
          academicPeriodId: selectedPeriodId ? String(selectedPeriodId) : null,
          academicPeriodLabel: selectedPeriod
            ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
            : null,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        summary: {
          studentCount: studentRows.length,
          recordedDays: recordedDays.size,
          totalRecords,
          attendanceRate,
          punctualityRate,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          averageLateMinutes,
          studentsWithNoRecordsCount,
        },
        dailySummary,
        students: studentRows.sort(
          (a, b) =>
            a.attendanceRate - b.attendanceRate || b.absentCount - a.absentCount
        ),
        segments: {
          habitualLatecomers,
          truants,
          regularStudents,
          attentionNeeded,
        },
        leo: {
          riskLevel: leoRiskLevel,
          headline: leoHeadline,
          summary:
            leoRiskLevel === "high"
              ? "Absence and punctuality patterns show a real risk of learning loss if left unattended."
              : leoRiskLevel === "medium"
              ? "The class is broadly stable, but the risk cluster needs early intervention before it spreads."
              : "Recorded attendance suggests the class is keeping a strong routine with only isolated issues.",
          insights: leoInsights,
          predictions: leoPredictions,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch class attendance analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch class attendance analytics",
      },
      { status: 500 }
    );
  }
}
