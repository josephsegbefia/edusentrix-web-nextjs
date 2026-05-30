import "server-only";

import mongoose, { Types } from "mongoose";
import { Guardian } from "@/models/Guardian";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";
import type { ExamInvigilatorAssignmentDTO } from "@/types/academics/exam-scheduling-engine";

type EntryNotificationContext = {
  entryId: string;
  title: string | null;
  subjectName: string;
  scheduleLabel: string;
  venueLabel: string | null;
  classGroupIds: string[];
};

function formatEntrySchedule(entry: Pick<IExamTimetableEntry, "date" | "startTime" | "endTime" | "isUnscheduled">) {
  if (entry.isUnscheduled) return "Unscheduled";
  const date = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${date}, ${entry.startTime}–${entry.endTime}`;
}

async function loadEntryNotificationContext(input: {
  schoolId: Types.ObjectId;
  entryId: Types.ObjectId;
}): Promise<EntryNotificationContext | null> {
  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    schoolId: input.schoolId,
  }).lean();

  if (!entry) return null;

  const [subject, venue] = await Promise.all([
    Subject.findOne({ _id: entry.subjectId, schoolId: input.schoolId }).select("name").lean(),
    entry.venueId
      ? ExamVenue.findOne({ _id: entry.venueId, schoolId: input.schoolId }).select("name").lean()
      : null,
  ]);

  const paperLabel = entry.title?.trim() || subject?.name || "Exam paper";

  return {
    entryId: String(entry._id),
    title: entry.title ?? null,
    subjectName: subject?.name ?? "Subject",
    scheduleLabel: formatEntrySchedule(entry),
    venueLabel: venue?.name ?? entry.roomLabel ?? null,
    classGroupIds: (entry.classGroupIds ?? []).map(String),
  };
}

async function resolveTeacherUserId(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
}) {
  const teacher = await Teacher.findOne({
    _id: input.teacherId,
    schoolId: input.schoolId,
  })
    .select("userId")
    .lean();

  const userId = teacher?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }

  return userId as Types.ObjectId;
}

function buildInvigilatorMessage(context: EntryNotificationContext, role?: string) {
  const venuePart = context.venueLabel ? ` in ${context.venueLabel}` : "";
  const rolePart = role ? ` as ${role}` : "";
  return `You have been assigned to invigilate ${context.subjectName} on ${context.scheduleLabel}${venuePart}${rolePart}.`;
}

export async function notifyExamInvigilatorAssigned(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  assignment: ExamInvigilatorAssignmentDTO;
  requireTeacherAcknowledgement: boolean;
}) {
  const [context, userId] = await Promise.all([
    loadEntryNotificationContext({
      schoolId: input.schoolId,
      entryId: new Types.ObjectId(input.assignment.examTimetableEntryId),
    }),
    resolveTeacherUserId({
      schoolId: input.schoolId,
      teacherId: new Types.ObjectId(input.assignment.teacherId),
    }),
  ]);

  if (!context || !userId) return;

  const body = buildInvigilatorMessage(context, input.assignment.role);
  const actionUrl = `/teacher/exams`;

  if (input.requireTeacherAcknowledgement) {
    await createTeacherNotification({
      schoolId: input.schoolId,
      userId,
      type: "reminder",
      priority: "high",
      title: "Invigilation duty requires acknowledgement",
      body: `${body} Please acknowledge this duty in My Exams.`,
      actionUrl,
      dedupeKey: `exam.invigilator_ack_required:${input.assignment.id}:${String(userId)}`,
      metadata: {
        event: "invigilator_acknowledgement_required",
        examSessionId: String(input.sessionId),
        assignmentId: input.assignment.id,
        examTimetableEntryId: input.assignment.examTimetableEntryId,
      },
    });
    return;
  }

  await createTeacherNotification({
    schoolId: input.schoolId,
    userId,
    type: "reminder",
    priority: "normal",
    title: "Invigilation duty assigned",
    body,
    actionUrl,
    dedupeKey: `exam.invigilator_assigned:${input.assignment.id}:${String(userId)}`,
    metadata: {
      event: "invigilator_assigned",
      examSessionId: String(input.sessionId),
      assignmentId: input.assignment.id,
      examTimetableEntryId: input.assignment.examTimetableEntryId,
    },
  });
}

export async function notifyExamInvigilatorReplaced(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  previousTeacherId: Types.ObjectId;
  replacementAssignment: ExamInvigilatorAssignmentDTO;
  requireTeacherAcknowledgement: boolean;
}) {
  const [context, previousUserId] = await Promise.all([
    loadEntryNotificationContext({
      schoolId: input.schoolId,
      entryId: new Types.ObjectId(input.replacementAssignment.examTimetableEntryId),
    }),
    resolveTeacherUserId({
      schoolId: input.schoolId,
      teacherId: input.previousTeacherId,
    }),
  ]);

  if (context && previousUserId) {
    await createTeacherNotification({
      schoolId: input.schoolId,
      userId: previousUserId,
      type: "system",
      priority: "normal",
      title: "Invigilation duty replaced",
      body: `Your invigilation duty for ${context.subjectName} on ${context.scheduleLabel} has been reassigned.`,
      actionUrl: "/teacher/exams",
      dedupeKey: `exam.invigilator_replaced:${input.replacementAssignment.examTimetableEntryId}:${String(previousUserId)}:${input.replacementAssignment.id}`,
      metadata: {
        event: "invigilator_replaced",
        examSessionId: String(input.sessionId),
        assignmentId: input.replacementAssignment.id,
      },
    });
  }

  await notifyExamInvigilatorAssigned({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    assignment: input.replacementAssignment,
    requireTeacherAcknowledgement: input.requireTeacherAcknowledgement,
  });
}

async function notifyUserExamTimetableEvent(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  session: IExamSession;
  versionNumber: number;
  changeSummary: string;
  event: "exam_timetable_published" | "exam_timetable_changed";
  audience: "teacher" | "parent" | "student" | "admin";
  wardId?: Types.ObjectId | null;
}) {
  const isRepublish = input.event === "exam_timetable_changed";
  const title = isRepublish ? "Exam timetable updated" : "Exam timetable published";
  const body = isRepublish
    ? `${input.session.name} was republished (v${input.versionNumber}). ${input.changeSummary}`
    : `${input.session.name} is now published. ${input.changeSummary}`;

  const actionUrl =
    input.audience === "parent"
      ? "/parent/academics"
      : input.audience === "student"
        ? "/student/academics"
        : `/admin/exams/sessions/${String(input.session._id)}/timetable`;

  await createTeacherNotification({
    schoolId: input.schoolId,
    userId: input.userId,
    type: "announcement",
    priority: isRepublish ? "high" : "normal",
    title,
    body,
    actionUrl,
    dedupeKey: `exam.${input.event}:${String(input.session._id)}:v${input.versionNumber}:${String(input.userId)}`,
    metadata: {
      event: input.event,
      examSessionId: String(input.session._id),
      versionNumber: input.versionNumber,
      audience: input.audience,
      wardId: input.wardId ? String(input.wardId) : undefined,
    },
  });
}

export async function notifyExamTimetablePublished(input: {
  schoolId: Types.ObjectId;
  session: IExamSession;
  versionNumber: number;
  changeSummary: string;
}) {
  const event =
    input.versionNumber > 1 ? "exam_timetable_changed" : "exam_timetable_published";

  const [entries, invigilators] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      status: { $nin: ["cancelled"] },
    })
      .select("subjectId classGroupIds academicPeriodId")
      .lean(),
    ExamInvigilatorAssignment.find({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      status: { $in: ["assigned", "acknowledged"] },
    })
      .select("teacherId")
      .lean(),
  ]);

  const notifiedUserIds = new Set<string>();

  for (const row of invigilators) {
    const userId = await resolveTeacherUserId({
      schoolId: input.schoolId,
      teacherId: row.teacherId as Types.ObjectId,
    });
    if (!userId || notifiedUserIds.has(String(userId))) continue;
    notifiedUserIds.add(String(userId));
    await notifyUserExamTimetableEvent({
      schoolId: input.schoolId,
      userId,
      session: input.session,
      versionNumber: input.versionNumber,
      changeSummary: input.changeSummary,
      event,
      audience: "teacher",
    });
  }

  const classGroupIds = [
    ...new Set(entries.flatMap((entry) => (entry.classGroupIds ?? []).map(String))),
  ].map((id) => new Types.ObjectId(id));

  if (classGroupIds.length > 0) {
    const subjectTeacherAssignments = await TeacherAssignment.find({
      schoolId: input.schoolId,
      academicPeriodId: input.session.academicPeriodId,
      classGroupId: { $in: classGroupIds },
      status: "active",
    })
      .select("teacherId")
      .lean();

    for (const assignment of subjectTeacherAssignments) {
      const userId = await resolveTeacherUserId({
        schoolId: input.schoolId,
        teacherId: assignment.teacherId as Types.ObjectId,
      });
      if (!userId || notifiedUserIds.has(String(userId))) continue;
      notifiedUserIds.add(String(userId));
      await notifyUserExamTimetableEvent({
        schoolId: input.schoolId,
        userId,
        session: input.session,
        versionNumber: input.versionNumber,
        changeSummary: input.changeSummary,
        event,
        audience: "teacher",
      });
    }
  }

  if (!input.session.allowParentStudentVisibility) {
    return;
  }

  if (classGroupIds.length === 0) return;

  const students = await Student.find({
    schoolId: input.schoolId,
    classGroupId: { $in: classGroupIds },
    status: "active",
  })
    .select("_id userId classGroupId")
    .lean();

  for (const student of students) {
    if (student.userId && mongoose.Types.ObjectId.isValid(String(student.userId))) {
      const userId = student.userId as Types.ObjectId;
      if (notifiedUserIds.has(String(userId))) continue;
      notifiedUserIds.add(String(userId));
      await notifyUserExamTimetableEvent({
        schoolId: input.schoolId,
        userId,
        session: input.session,
        versionNumber: input.versionNumber,
        changeSummary: input.changeSummary,
        event,
        audience: "student",
      });
    }
  }

  const studentIds = students.map((row) => row._id as Types.ObjectId);
  if (studentIds.length === 0) return;

  const guardians = await Guardian.find({
    studentId: { $in: studentIds },
  })
    .select("userId studentId")
    .lean();

  for (const guardian of guardians) {
    const userId = guardian.userId as Types.ObjectId;
    if (!userId || notifiedUserIds.has(String(userId))) continue;
    notifiedUserIds.add(String(userId));
    await notifyUserExamTimetableEvent({
      schoolId: input.schoolId,
      userId,
      session: input.session,
      versionNumber: input.versionNumber,
      changeSummary: input.changeSummary,
      event,
      audience: "parent",
      wardId: guardian.studentId as Types.ObjectId,
    });
  }
}
