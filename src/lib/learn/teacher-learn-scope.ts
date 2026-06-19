import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnActivityEvent, type LearnActivityEventType } from "@/models/LearnActivityEvent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import {
  getClassJourneyOversight,
  getStudentJourneyOversight,
} from "@/lib/learn/journey-oversight";

export type TeacherLearnContext = {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  homeroomClassGroupId?: Types.ObjectId | null;
};

type ClassRow = {
  _id: Types.ObjectId;
  name: string;
  gradeId?: Types.ObjectId | null;
};

type GradeRow = {
  _id: Types.ObjectId;
  name: string;
};

type StudentRow = {
  _id: Types.ObjectId;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  admissionNo?: string | null;
  classGroupId?: Types.ObjectId | null;
};

type ActivityClassRow = {
  _id: Types.ObjectId;
  count: number;
};

type ActivityTypeRow = {
  _id: LearnActivityEventType;
  count: number;
};

type AccountClassRow = {
  _id: Types.ObjectId;
  count: number;
};

export const TEACHER_LEARN_EVENT_LABELS: Record<LearnActivityEventType, string> = {
  quest_completed: "Quests completed",
  leo_tutor_message: "Leo tutor messages",
  flashcard_reviewed: "Flashcards reviewed",
  revision_session: "Revision sessions",
  exam_prep_practice: "Exam prep practice",
  explore_with_leo: "Explore with Leo",
  language_practice: "Language practice",
  assignment_help: "Assignment help",
  login: "Logins",
};

function fullName(student: StudentRow) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getTeacherLearnClassIds(ctx: TeacherLearnContext) {
  const currentPeriod = await AcademicPeriod.findOne({
    schoolId: ctx.schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  const classIds = new Set<string>();
  if (ctx.homeroomClassGroupId) classIds.add(String(ctx.homeroomClassGroupId));

  if (currentPeriod) {
    const assignments = await TeacherAssignment.find({
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
      academicPeriodId: currentPeriod._id,
      status: "active",
    })
      .select("classGroupId")
      .lean<Array<{ classGroupId: Types.ObjectId }>>();
    for (const assignment of assignments) {
      classIds.add(String(assignment.classGroupId));
    }
  }

  return Array.from(classIds).map((id) => new Types.ObjectId(id));
}

export async function getTeacherLearnOverview(ctx: TeacherLearnContext) {
  const classIds = await getTeacherLearnClassIds(ctx);
  const start = new Date();
  start.setDate(start.getDate() - 30);

  if (!classIds.length) {
    return {
      rangeDays: 30,
      classes: [],
      totals: {
        assignedClasses: 0,
        students: 0,
        studentsWithAccounts: 0,
        activity: 0,
      },
      events: [],
    };
  }

  const [classes, students, accountRows, activityRows, eventRows] = await Promise.all([
    ClassGroup.find({ _id: { $in: classIds }, schoolId: ctx.schoolId })
      .select("_id name gradeId")
      .lean<ClassRow[]>(),
    Student.find({
      schoolId: ctx.schoolId,
      classGroupId: { $in: classIds },
      status: "active",
    })
      .select("_id classGroupId")
      .lean<StudentRow[]>(),
    LearnStudentAccount.aggregate<AccountClassRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          status: { $in: ["pending_first_login", "active", "locked"] },
        },
      },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      { $match: { "student.classGroupId": { $in: classIds } } },
      { $group: { _id: "$student.classGroupId", count: { $sum: 1 } } },
    ]),
    LearnActivityEvent.aggregate<ActivityClassRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          classGroupId: { $in: classIds },
          occurredAt: { $gte: start },
        },
      },
      { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
    ]),
    LearnActivityEvent.aggregate<ActivityTypeRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          classGroupId: { $in: classIds },
          occurredAt: { $gte: start },
        },
      },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const gradeIds = Array.from(new Set(classes.map((row) => String(row.gradeId || "")).filter(Boolean)));
  const grades = await Grade.find({ _id: { $in: gradeIds }, schoolId: ctx.schoolId })
    .select("_id name")
    .lean<GradeRow[]>();
  const gradeMap = new Map(grades.map((grade) => [String(grade._id), grade.name]));
  const studentCountMap = new Map<string, number>();
  for (const student of students) {
    const key = String(student.classGroupId);
    studentCountMap.set(key, (studentCountMap.get(key) || 0) + 1);
  }
  const accountMap = new Map(accountRows.map((row) => [String(row._id), row.count]));
  const activityMap = new Map(activityRows.map((row) => [String(row._id), row.count]));

  return {
    rangeDays: 30,
    classes: classes.map((row) => ({
      classGroupId: String(row._id),
      classGroupName: row.name,
      gradeName: row.gradeId ? gradeMap.get(String(row.gradeId)) || null : null,
      studentCount: studentCountMap.get(String(row._id)) || 0,
      studentsWithAccounts: accountMap.get(String(row._id)) || 0,
      activityCount: activityMap.get(String(row._id)) || 0,
    })),
    totals: {
      assignedClasses: classes.length,
      students: students.length,
      studentsWithAccounts: accountRows.reduce((sum, row) => sum + row.count, 0),
      activity: activityRows.reduce((sum, row) => sum + row.count, 0),
    },
    events: eventRows.map((row) => ({
      eventType: row._id,
      label: TEACHER_LEARN_EVENT_LABELS[row._id],
      count: row.count,
    })),
  };
}

export async function getTeacherLearnClassDetail(
  ctx: TeacherLearnContext,
  classGroupId: Types.ObjectId
) {
  const allowedClassIds = await getTeacherLearnClassIds(ctx);
  if (!allowedClassIds.some((id) => String(id) === String(classGroupId))) {
    return null;
  }

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const [classGroup, students, eventRows] = await Promise.all([
    ClassGroup.findOne({ _id: classGroupId, schoolId: ctx.schoolId })
      .select("_id name gradeId")
      .lean<ClassRow | null>(),
    Student.find({
      schoolId: ctx.schoolId,
      classGroupId,
      status: "active",
    })
      .select("_id firstName middleName lastName admissionNo classGroupId")
      .sort({ lastName: 1, firstName: 1 })
      .lean<StudentRow[]>(),
    LearnActivityEvent.aggregate<ActivityTypeRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          classGroupId,
          occurredAt: { $gte: start },
        },
      },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  if (!classGroup) return null;

  const studentIds = students.map((student) => student._id);
  const [accounts, studentActivity] = await Promise.all([
    LearnStudentAccount.find({
      schoolId: ctx.schoolId,
      studentId: { $in: studentIds },
      status: { $in: ["pending_first_login", "active", "locked"] },
    })
      .select("studentId status")
      .lean<Array<{ studentId: Types.ObjectId; status: string }>>(),
    LearnActivityEvent.aggregate<ActivityClassRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          studentId: { $in: studentIds },
          occurredAt: { $gte: start },
        },
      },
      { $group: { _id: "$studentId", count: { $sum: 1 } } },
    ]),
  ]);

  const accountMap = new Map(accounts.map((account) => [String(account.studentId), account.status]));
  const activityMap = new Map(studentActivity.map((row) => [String(row._id), row.count]));
  const journeyOversight = await getClassJourneyOversight({
    schoolId: ctx.schoolId,
    classGroupId,
    studentIds,
  });

  return {
    classGroup: {
      id: String(classGroup._id),
      name: classGroup.name,
    },
    journeyOversight,
    students: students.map((student) => ({
      id: String(student._id),
      name: fullName(student),
      admissionNo: student.admissionNo || null,
      accountStatus: accountMap.get(String(student._id)) || null,
      activityCount: activityMap.get(String(student._id)) || 0,
    })),
    events: eventRows.map((row) => ({
      eventType: row._id,
      label: TEACHER_LEARN_EVENT_LABELS[row._id],
      count: row.count,
    })),
  };
}

export async function getTeacherLearnStudentDetail(
  ctx: TeacherLearnContext,
  studentId: Types.ObjectId
) {
  const allowedClassIds = await getTeacherLearnClassIds(ctx);
  if (!allowedClassIds.length) return null;

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const student = await Student.findOne({
    _id: studentId,
    schoolId: ctx.schoolId,
    classGroupId: { $in: allowedClassIds },
  })
    .select("_id firstName middleName lastName admissionNo classGroupId")
    .lean<StudentRow | null>();
  if (!student) return null;

  const [account, eventRows, recentEvents, journeyOversight] = await Promise.all([
    LearnStudentAccount.findOne({ schoolId: ctx.schoolId, studentId })
      .select("status mustChangePassword lastLoginAt")
      .lean<{ status: string; mustChangePassword: boolean; lastLoginAt?: Date | null } | null>(),
    LearnActivityEvent.aggregate<ActivityTypeRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          studentId,
          occurredAt: { $gte: start },
        },
      },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LearnActivityEvent.find({
      schoolId: ctx.schoolId,
      studentId,
      occurredAt: { $gte: start },
    })
      .sort({ occurredAt: -1 })
      .limit(20)
      .select("eventType occurredAt topic score durationSeconds")
      .lean<
        Array<{
          eventType: LearnActivityEventType;
          occurredAt: Date;
          topic?: string | null;
          score?: number | null;
          durationSeconds?: number | null;
        }>
      >(),
    getStudentJourneyOversight({
      schoolId: ctx.schoolId,
      studentId,
    }),
  ]);

  return {
    student: {
      id: String(student._id),
      name: fullName(student),
      admissionNo: student.admissionNo || null,
      accountStatus: account?.status || null,
      mustChangePassword: account?.mustChangePassword || false,
      lastLoginAt: account?.lastLoginAt?.toISOString?.() || null,
    },
    events: eventRows.map((row) => ({
      eventType: row._id,
      label: TEACHER_LEARN_EVENT_LABELS[row._id],
      count: row.count,
    })),
    recentEvents: recentEvents.map((event) => ({
      eventType: event.eventType,
      label: TEACHER_LEARN_EVENT_LABELS[event.eventType],
      occurredAt: event.occurredAt.toISOString(),
      topic: event.topic || null,
      score: event.score ?? null,
      durationSeconds: event.durationSeconds ?? null,
    })),
    journeyOversight,
  };
}
