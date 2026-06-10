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
import { Subject } from "@/models/Subject";
import { formatDateYmd, getPublishedWeekTimetable } from "@/lib/timetable/read-model";
import { getTeacherStudioEnabledForSchool } from "@/lib/features/teacherStudio";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { calculateAtRiskStudents, calculateMissingMarks } from "@/lib/teacher/analytics";
import {
  resolveCurrentSchoolSchemeWeek,
  schemeItemOverlapsCalendarWeek,
} from "@/lib/schemes/resolve-scheme-week";
import {
  loadTeacherAssignmentScopes,
  teacherAssignedSchemeListFilter,
} from "@/lib/schemes/teacher-assigned-schemes";

type PopulatedClassGroup = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gradeId?: mongoose.Types.ObjectId | null;
  homeroomTeacherId?: mongoose.Types.ObjectId | null;
};

type ScheduleSlot = {
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

type TeacherDashboardAssignmentLean = {
  classGroupId?: PopulatedClassGroup | mongoose.Types.ObjectId | null;
  subjectId?: mongoose.Types.ObjectId | null;
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
  date: string;
};

type WeekScheduleDay = {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  slots: TodayScheduleRow[];
};

type WeekSchedulePayload = {
  weekStart: string;
  weekEnd: string;
  days: WeekScheduleDay[];
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

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id yearLabel term startDate endDate")
      .lean<{
        _id: mongoose.Types.ObjectId;
        yearLabel: string;
        term: string;
        startDate: Date;
        endDate: Date;
      } | null>();

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
          weekSchedule: null,
          thisWeekSchemeRows: [],
          currentSchemeWeek: null,
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
      .populate("subjectOfferingId", "subjectId")
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

    let schedule: TodayScheduleRow[] = [];
    let weekSchedule: WeekSchedulePayload | null = null;
    const todayYmd = formatDateYmd(today);
    const weekly = await getPublishedWeekTimetable({
      schoolId: context.schoolId,
      targetDate: today,
      scope: "teacher",
      teacherId: context.teacherId,
    });
    if (!("error" in weekly) && weekly.data?.days) {
      weekSchedule = {
        weekStart: weekly.data.weekStart,
        weekEnd: weekly.data.weekEnd,
        days: weekly.data.days.map((day) => ({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          isToday: day.date === todayYmd,
          slots: (day.slots || [])
            .map((slot) => ({
              classGroupId: slot.classGroupId || "",
              className: [slot.gradeName, slot.classGroupName].filter(Boolean).join(" ").trim() || "",
              subjectId: slot.subjectId || "",
              subjectName: slot.subjectName || "",
              startTime: slot.startTime || null,
              endTime: slot.endTime || null,
              date: day.date,
            }))
            .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
        })),
      };
      schedule = weekSchedule.days.find((day) => day.isToday)?.slots || [];
    }

    const attendanceQueueCount = context.homeroomClassGroupId
      ? todayAttendanceTaken
        ? 0
        : 1
      : 0;

    const currentSchemeWeek = currentPeriod
      ? resolveCurrentSchoolSchemeWeek({
          period: {
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
          },
          academicPeriodId: String(currentPeriod._id),
          academicPeriodLabel: `${currentPeriod.yearLabel} • ${currentPeriod.term}`,
        })
      : null;

    let thisWeekSchemeRows: DashboardSchemeRow[] = [];
    const schemeListFilter = await teacherAssignedSchemeListFilter({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });
    if (
      schemeListFilter &&
      currentSchemeWeek?.weekStartDate &&
      currentSchemeWeek.weekEndDate &&
      currentPeriod
    ) {
      const weekStart = new Date(`${currentSchemeWeek.weekStartDate}T00:00:00.000Z`);
      const weekEnd = new Date(`${currentSchemeWeek.weekEndDate}T00:00:00.000Z`);
      const periodInput = {
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
      };
      const assignmentScopes = await loadTeacherAssignmentScopes(
        { schoolId: context.schoolId, teacherId: context.teacherId },
        currentPeriod._id
      );

      const visibleSchemes = (await SchemeOfWork.find(schemeListFilter)
        .select("_id title classGroupId gradeId subjectId subjectOfferingId")
        .lean()) as ISchemeOfWork[];

      const schemeIds = visibleSchemes.map((scheme) => scheme._id);
      const schemeMap = new Map(visibleSchemes.map((scheme) => [String(scheme._id), scheme]));
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
      const scopedSubjectIds = [
        ...new Set(assignmentScopes.map((scope) => String(scope.subjectId))),
      ].map((id) => new mongoose.Types.ObjectId(id));
      const scopedSubjects = scopedSubjectIds.length
        ? await Subject.find({ _id: { $in: scopedSubjectIds }, schoolId: context.schoolId })
            .select("name")
            .lean<Array<{ _id: mongoose.Types.ObjectId; name: string }>>()
        : [];
      const subjectNameById = new Map(
        scopedSubjects.map((subject) => [String(subject._id), subject.name] as const)
      );

      function classNamesForScheme(scheme: ISchemeOfWork): string {
        if (scheme.classGroupId) {
          return classNameById.get(String(scheme.classGroupId)) || "";
        }
        const matchingScopes = assignmentScopes.filter((scope) => {
          const gradeMatches = scheme.gradeId && String(scope.gradeId) === String(scheme.gradeId);
          const subjectMatches =
            scheme.subjectId && String(scope.subjectId) === String(scheme.subjectId);
          const offeringMatches =
            scheme.subjectOfferingId &&
            scope.subjectOfferingId &&
            String(scope.subjectOfferingId) === String(scheme.subjectOfferingId);
          return gradeMatches && (subjectMatches || offeringMatches);
        });
        const names = matchingScopes
          .map((scope) => classNameById.get(String(scope.classGroupId)) || "")
          .filter(Boolean);
        return Array.from(new Set(names)).join(" · ");
      }

      const items = schemeIds.length
        ? ((await SchemeItem.find({
            schoolId: context.schoolId,
            schemeId: { $in: schemeIds },
            status: { $ne: "dropped" },
            coverageStatus: { $nin: ["covered", "skipped"] },
          })
            .sort({ weekNumber: 1, plannedStartDate: 1, plannedEndDate: 1, sequence: 1 })
            .limit(80)
            .lean()) as ISchemeItem[])
        : [];

      const currentWeekItems = items
        .filter((item) =>
          schemeItemOverlapsCalendarWeek(item, periodInput, weekStart, weekEnd)
        )
        .slice(0, 8);

      thisWeekSchemeRows = currentWeekItems.map((item) => {
        const scheme = schemeMap.get(String(item.schemeId));
        return {
          id: String(item._id),
          schemeId: String(item.schemeId),
          schemeTitle: scheme?.title || "Scheme of Learning",
          title: item.title || item.topic || "Scheme row",
          weekNumber: item.weekNumber ?? null,
          className: scheme ? classNamesForScheme(scheme) : "",
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
        weekSchedule,
        thisWeekSchemeRows,
        currentSchemeWeek,
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
