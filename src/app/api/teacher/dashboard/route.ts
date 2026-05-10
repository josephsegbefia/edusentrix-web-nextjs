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
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { getPublishedWeekTimetable } from "@/lib/timetable/read-model";
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

type DashboardSchemeRow = {
  id: string;
  schemeId: string;
  schemeTitle: string;
  title: string;
  weekNumber: number | null;
  className: string;
  subjectName: string;
  coverageStatus: string;
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

function weekBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const diff = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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
          thisWeekSchemeRows: [],
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

    const assignmentPairs = assignments
      .map((assignment) => {
        const group = assignment.classGroupId;
        const subject = assignment.subjectId;
        const classGroupId = group
          ? isPopulatedClassGroup(group)
            ? String(group._id)
            : String(group)
          : "";
        const subjectId = subject
          ? isPopulatedSubject(subject)
            ? String(subject._id)
            : String(subject)
          : "";
        if (!classGroupId || !subjectId) return null;
        return { classGroupId, subjectId };
      })
      .filter(Boolean) as Array<{ classGroupId: string; subjectId: string }>;

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

    let schedule: TodayScheduleRow[] = [];
    const weekly = await getPublishedWeekTimetable({
      schoolId: context.schoolId,
      targetDate: today,
      scope: "teacher",
      teacherId: context.teacherId,
    });
    if (!("error" in weekly) && weekly.data?.days) {
      const todaySlots = weekly.data.days.find((d) => d.dayOfWeek === dayOfWeek)?.slots || [];
      schedule = todaySlots
        .map((slot) => ({
          classGroupId: slot.classGroupId || "",
          className: [slot.gradeName, slot.classGroupName].filter(Boolean).join(" ").trim() || "",
          subjectId: slot.subjectId || "",
          subjectName: slot.subjectName || "",
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
        }))
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    }

    const attendanceQueueCount = context.homeroomClassGroupId
      ? todayAttendanceTaken
        ? 0
        : 1
      : 0;

    let thisWeekSchemeRows: DashboardSchemeRow[] = [];
    if (assignmentPairs.length > 0) {
      const { start: weekStart, end: weekEnd } = weekBounds(today);
      const activeSchemes = (await SchemeOfWork.find({
        schoolId: context.schoolId,
        academicPeriodId: currentPeriod._id,
        status: "active",
        $or: assignmentPairs.map((pair) => ({
          classGroupId: new mongoose.Types.ObjectId(pair.classGroupId),
          subjectId: new mongoose.Types.ObjectId(pair.subjectId),
        })),
      })
        .select("_id title classGroupId subjectId")
        .lean()) as ISchemeOfWork[];

      const schemeIds = activeSchemes.map((scheme) => scheme._id);
      const schemeMap = new Map(activeSchemes.map((scheme) => [String(scheme._id), scheme]));
      const classNameById = new Map(
        assignments
          .map((assignment) => {
            const group = assignment.classGroupId;
            if (!isPopulatedClassGroup(group)) return null;
            const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : "";
            return [String(group._id), [gradeName, group.name].filter(Boolean).join(" ").trim()] as const;
          })
          .filter(Boolean) as Array<readonly [string, string]>
      );
      const subjectNameById = new Map(
        assignments
          .map((assignment) => {
            const subject = assignment.subjectId;
            if (!isPopulatedSubject(subject)) return null;
            return [String(subject._id), subject.name] as const;
          })
          .filter(Boolean) as Array<readonly [string, string]>
      );

      const items = schemeIds.length
        ? ((await SchemeItem.find({
            schoolId: context.schoolId,
            schemeId: { $in: schemeIds },
            status: { $ne: "dropped" },
            coverageStatus: { $nin: ["covered", "skipped"] },
            $or: [
              { plannedStartDate: { $lte: weekEnd }, plannedEndDate: { $gte: weekStart } },
              { plannedStartDate: null, plannedEndDate: { $gte: weekStart, $lte: weekEnd } },
              { plannedStartDate: { $gte: weekStart, $lte: weekEnd }, plannedEndDate: null },
            ],
          })
            .sort({ plannedStartDate: 1, plannedEndDate: 1, weekNumber: 1, sequence: 1 })
            .limit(8)
            .lean()) as ISchemeItem[])
        : [];

      thisWeekSchemeRows = items.map((item) => {
        const scheme = schemeMap.get(String(item.schemeId));
        return {
          id: String(item._id),
          schemeId: String(item.schemeId),
          schemeTitle: scheme?.title || "Scheme of Learning",
          title: item.title || item.topic || "Scheme row",
          weekNumber: item.weekNumber ?? null,
          className: scheme?.classGroupId ? classNameById.get(String(scheme.classGroupId)) || "" : "",
          subjectName: scheme?.subjectId ? subjectNameById.get(String(scheme.subjectId)) || "" : "",
          coverageStatus: item.coverageStatus || "not_started",
        };
      });
    }

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
        id: "scheme-week",
        label: "Scheme rows this week",
        count: thisWeekSchemeRows.length,
        href: "/teacher/schemes",
        tone: "emerald",
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
        thisWeekSchemeRows,
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
