import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Grade } from "@/models/Grade";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Submission } from "@/models/Submission";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { getTeacherStudioEnabledForSchool } from "@/lib/features/teacherStudio";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { calculateAtRiskStudents, calculateMissingMarks } from "@/lib/teacher/analytics";

type PopulatedClassGroup = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gradeId?: mongoose.Types.ObjectId | null;
  homeroomTeacherId?: mongoose.Types.ObjectId | null;
};

type PopulatedSubject = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type ScheduleSlot = {
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

type TeacherDashboardAssignmentLean = {
  classGroupId?: PopulatedClassGroup | mongoose.Types.ObjectId | null;
  subjectId?: PopulatedSubject | mongoose.Types.ObjectId | null;
  schedules?: ScheduleSlot[];
  schedule?: ScheduleSlot | null;
};

type StudentCountRow = {
  _id: mongoose.Types.ObjectId;
  count: number;
};

type GradeNameRow = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type TodayScheduleRow = {
  classGroupId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  startTime: string | null;
  endTime: string | null;
};

function isPopulatedClassGroup(
  value: TeacherDashboardAssignmentLean["classGroupId"]
): value is PopulatedClassGroup {
  return Boolean(value && typeof value === "object" && "_id" in value && "name" in value);
}

function isPopulatedSubject(
  value: TeacherDashboardAssignmentLean["subjectId"]
): value is PopulatedSubject {
  return Boolean(value && typeof value === "object" && "_id" in value && "name" in value);
}

function toMinutes(time?: string | null) {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hh, mm] = time.split(":").map((v) => Number(v));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return Number.MAX_SAFE_INTEGER;
  return hh * 60 + mm;
}

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const today = new Date();
    const dayOfWeek = today.getDay();

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean();

    if (!currentPeriod) {
      return Response.json({
        success: true,
        data: {
          stats: {
            totalClasses: 0,
            totalStudents: 0,
            pendingToMark: 0,
            todayAttendanceTaken: false,
          },
          today: {
            date: today.toISOString(),
            schedule: [],
          },
          queues: [],
        },
      });
    }

    const assignments = await TeacherAssignment.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId: currentPeriod._id,
      status: "active",
    })
      .populate("classGroupId", "name gradeId homeroomTeacherId")
      .populate("subjectId", "name")
      .lean<TeacherDashboardAssignmentLean[]>();

    const totalClasses = assignments.length;

    const classGroupIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.classGroupId)
          .filter(Boolean)
          .map((group) =>
            isPopulatedClassGroup(group) ? String(group._id) : String(group)
          )
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const gradeIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.classGroupId)
          .map((group) =>
            isPopulatedClassGroup(group) && group.gradeId
              ? String(group.gradeId)
              : null
          )
          .filter(Boolean)
      )
    ).map((id) => new mongoose.Types.ObjectId(String(id)));

    const [studentCounts, grades] = await Promise.all([
      classGroupIds.length
        ? Student.aggregate([
            {
              $match: {
                schoolId: context.schoolId,
                classGroupId: { $in: classGroupIds },
                status: "active",
              },
            },
            { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      gradeIds.length
        ? Grade.find({ _id: { $in: gradeIds } }).select("name").lean()
        : Promise.resolve([]),
    ]);

    const studentCountMap = new Map(
      studentCounts.map((entry: StudentCountRow) => [
        String(entry._id),
        entry.count,
      ])
    );
    const gradeMap = new Map(
      grades.map((grade: GradeNameRow) => [
        String(grade._id),
        grade.name,
      ])
    );

    const totalStudents = Array.from(studentCountMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const homeworkIds = await Homework.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      status: { $in: ["published", "closed"] },
    })
      .select("_id")
      .lean();

    const pendingToMark = homeworkIds.length
      ? await Submission.countDocuments({
          homeworkId: { $in: homeworkIds.map((hw) => hw._id) },
          status: { $in: ["submitted", "late"] },
        })
      : 0;

    const teacherStudioEnabled = await getTeacherStudioEnabledForSchool(
      context.schoolId
    );
    const canViewAssignments = can(
      context.permissions,
      PERMISSIONS.assignmentsView
    );
    const canGradeAssignments = can(
      context.permissions,
      PERMISSIONS.assignmentsGrade
    );
    const canViewAtRisk = can(context.permissions, PERMISSIONS.analyticsAtRisk);
    const showStudio = teacherStudioEnabled && canViewAssignments;

    const missingMarks = showStudio
      ? await calculateMissingMarks({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          academicPeriodId: currentPeriod._id,
          classGroupIds,
        })
      : 0;

    const atRiskCount = canViewAtRisk
      ? (
          await calculateAtRiskStudents({
            schoolId: context.schoolId,
            teacherId: context.teacherId,
            academicPeriodId: currentPeriod._id,
            classGroupIds,
          })
        ).total
      : 0;

    let todayAttendanceTaken = false;
    if (context.homeroomClassGroupId) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const attendance = await StudentAttendance.findOne({
        schoolId: context.schoolId,
        classGroupId: context.homeroomClassGroupId,
        type: "homeroom",
        date: { $gte: start, $lte: end },
      })
        .select("_id")
        .lean();
      todayAttendanceTaken = !!attendance;
    }

    const schedule = assignments
      .flatMap((assignment): TodayScheduleRow[] => {
        const classGroup = isPopulatedClassGroup(assignment.classGroupId)
          ? assignment.classGroupId
          : undefined;
        const subject = isPopulatedSubject(assignment.subjectId)
          ? assignment.subjectId
          : undefined;

        const gradeName = classGroup
          ? gradeMap.get(String(classGroup.gradeId))
          : undefined;
        const className = classGroup
          ? `${gradeName ? gradeName + " " : ""}${classGroup.name}`.trim()
          : "";

        const slots = (
          assignment.schedules
            ? assignment.schedules
            : assignment.schedule
              ? [assignment.schedule]
              : []
        ).filter((slot): slot is ScheduleSlot => Boolean(slot));

        return slots
          .filter((slot) => slot.dayOfWeek === dayOfWeek)
          .map((slot) => ({
            classGroupId: classGroup?._id ? String(classGroup._id) : "",
            className,
            subjectId: subject?._id ? String(subject._id) : "",
            subjectName: subject?.name || "",
            startTime: slot.startTime || null,
            endTime: slot.endTime || null,
          }));
      })
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    const attendanceQueueCount = context.homeroomClassGroupId
      ? todayAttendanceTaken
        ? 0
        : 1
      : 0;

    const queues = [
      ...(showStudio
        ? [
            {
              id: "to-mark",
              label: "To Mark",
              count: canGradeAssignments ? pendingToMark : 0,
              href: "/teacher/studio/submissions",
              tone: "amber",
            },
            {
              id: "missing-marks",
              label: "Missing Marks",
              count: missingMarks,
              href: "/teacher/studio/submissions",
              tone: "emerald",
            },
          ]
        : []),
      {
        id: "attendance",
        label: "Attendance Follow-ups",
        count: attendanceQueueCount,
        href: "/teacher/attendance",
        tone: "indigo",
      },
      {
        id: "at-risk",
        label: "Students At Risk",
        count: atRiskCount,
        href: "/teacher/analytics/at-risk",
        tone: "rose",
      },
    ];

    return Response.json({
      success: true,
      data: {
        stats: {
          totalClasses,
          totalStudents,
          pendingToMark: showStudio && canGradeAssignments ? pendingToMark : 0,
          todayAttendanceTaken,
        },
        today: {
          date: today.toISOString(),
          schedule,
        },
        queues,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load teacher dashboard:", e);
    const message =
      e instanceof Error ? e.message : "Failed to load dashboard";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
