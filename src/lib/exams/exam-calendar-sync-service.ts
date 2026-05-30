import { Types } from "mongoose";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamCalendarEventLink } from "@/models/ExamCalendarEventLink";
import { ExamInvigilatorAssignment, type IExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import type { ExamCalendarSyncResultDTO } from "@/types/academics/exam-scheduling-engine";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  buildExamCalendarSourceRefKey,
  combineExamDateAndTime,
} from "@/lib/exams/exam-scheduler-validation";

export class ExamCalendarSyncServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamCalendarSyncServiceError";
    this.status = status;
  }
}

const ACTIVE_INVIGILATOR_STATUSES = ["assigned", "acknowledged"];

async function resolveOrCreateExamCalendar(input: {
  schoolId: Types.ObjectId;
  session: IExamSession;
  actorId: Types.ObjectId;
}) {
  const existing = await AcademicCalendar.findOne({
    schoolId: input.schoolId,
    academicPeriodId: input.session.academicPeriodId,
    name: "Exam Timetable",
  });

  if (existing) return existing;

  return AcademicCalendar.create({
    schoolId: input.schoolId,
    academicPeriodId: input.session.academicPeriodId,
    name: "Exam Timetable",
    description: "Published exam papers and invigilation duties",
    color: "#06b6d4",
    isPublished: true,
    editors: [input.actorId],
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });
}

export async function syncExamSessionCalendarEvents(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  session: IExamSession;
  entries: IExamTimetableEntry[];
  invigilators: IExamInvigilatorAssignment[];
  versionNumber: number;
}): Promise<ExamCalendarSyncResultDTO> {
  const calendar = await resolveOrCreateExamCalendar(input);
  const scheduledEntries = input.entries.filter(
    (entry) => !entry.isUnscheduled && entry.status !== "cancelled"
  );

  const subjectIds = scheduledEntries.map((entry) => entry.subjectId);
  const classGroupIds = scheduledEntries.flatMap((entry) => entry.classGroupIds);
  const venueIds = scheduledEntries
    .map((entry) => entry.venueId)
    .filter((value): value is Types.ObjectId => Boolean(value));

  const [subjects, classGroups, venues, teachers] = await Promise.all([
    subjectIds.length
      ? Subject.find({ _id: { $in: subjectIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    classGroupIds.length
      ? ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    venueIds.length
      ? ExamVenue.find({ _id: { $in: venueIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    input.invigilators.length
      ? Teacher.find({ _id: { $in: input.invigilators.map((row) => row.teacherId) }, schoolId: input.schoolId })
          .select("_id userId")
          .lean()
      : Promise.resolve([]),
  ]);

  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));
  const classGroupMap = new Map(classGroups.map((row) => [String(row._id), row.name]));
  const venueMap = new Map(venues.map((row) => [String(row._id), row.name]));
  const teacherUserMap = new Map(
    teachers.map((row) => [String(row._id), row.userId ? String(row.userId) : null])
  );

  let createdCount = 0;
  let updatedCount = 0;
  const activeSourceKeys = new Set<string>();
  const linkedEventIds: string[] = [];

  for (const entry of scheduledEntries) {
    const classNames = entry.classGroupIds
      .map((id) => classGroupMap.get(String(id)))
      .filter(Boolean)
      .join(", ");
    const subjectName = subjectMap.get(String(entry.subjectId)) ?? "Subject";
    const venueLabel = entry.venueId
      ? venueMap.get(String(entry.venueId)) ?? entry.roomLabel ?? null
      : entry.roomLabel ?? null;
    const sourceRefKey = buildExamCalendarSourceRefKey({
      linkKind: "exam_entry",
      sourceRefId: String(entry._id),
    });
    activeSourceKeys.add(sourceRefKey);

    const startDate = combineExamDateAndTime(entry.date, entry.startTime);
    const endDate = combineExamDateAndTime(entry.date, entry.endTime);
    const title = `Exam: ${classNames || "Class"} ${subjectName}`.trim();
    const description = [
      entry.instructionsForStudents?.trim(),
      entry.materialsAllowed?.length
        ? `Materials allowed: ${entry.materialsAllowed.join(", ")}`
        : null,
      `Exam session: ${input.session.name}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      schoolId: input.schoolId,
      calendarId: calendar._id,
      academicPeriodId: input.session.academicPeriodId,
      title,
      description: description || null,
      startDate,
      endDate,
      allDay: false,
      location: venueLabel,
      color: calendar.color ?? "#06b6d4",
      status: "published" as const,
      eventType: "exam" as const,
      isNonTeachingDay: false,
      audience: {
        scope: input.session.allowParentStudentVisibility ? ("classes" as const) : ("school" as const),
        classGroupIds: entry.classGroupIds,
        gradeIds: entry.gradeId ? [entry.gradeId] : [],
        userIds: [],
        roles: input.session.allowParentStudentVisibility ? ["parent", "student", "teacher"] : ["teacher"],
      },
      recurrence: null,
      editorScope: "calendar" as const,
      editorIds: [],
      reminders: [],
      updatedBy: input.actorId,
    };

    const existingLink = await ExamCalendarEventLink.findOne({
      schoolId: input.schoolId,
      sourceRefKey,
    });

    if (existingLink) {
      await AcademicCalendarEvent.updateOne(
        { _id: existingLink.calendarEventId, schoolId: input.schoolId },
        { $set: payload }
      );
      existingLink.versionNumber = input.versionNumber;
      await existingLink.save();
      updatedCount += 1;
      linkedEventIds.push(String(existingLink.calendarEventId));
      continue;
    }

    const event = await AcademicCalendarEvent.create({
      ...payload,
      createdBy: input.actorId,
    });

    await ExamCalendarEventLink.create({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      calendarId: calendar._id,
      calendarEventId: event._id,
      linkKind: "exam_entry",
      sourceRefId: entry._id,
      sourceRefKey,
      versionNumber: input.versionNumber,
    });

    createdCount += 1;
    linkedEventIds.push(String(event._id));
  }

  const activeInvigilators = input.invigilators.filter((row) =>
    ACTIVE_INVIGILATOR_STATUSES.includes(row.status)
  );

  for (const assignment of activeInvigilators) {
    const entry = scheduledEntries.find(
      (row) => String(row._id) === String(assignment.examTimetableEntryId)
    );
    if (!entry) continue;

    const teacherUserId = teacherUserMap.get(String(assignment.teacherId));
    if (!teacherUserId) continue;

    const subjectName = subjectMap.get(String(entry.subjectId)) ?? "Subject";
    const classNames = entry.classGroupIds
      .map((id) => classGroupMap.get(String(id)))
      .filter(Boolean)
      .join(", ");
    const sourceRefKey = buildExamCalendarSourceRefKey({
      linkKind: "invigilation",
      sourceRefId: String(assignment._id),
    });
    activeSourceKeys.add(sourceRefKey);

    const startDate = combineExamDateAndTime(entry.date, entry.startTime);
    const endDate = combineExamDateAndTime(entry.date, entry.endTime);
    const title = `Invigilation: ${classNames || "Class"} ${subjectName}`.trim();

    const payload = {
      schoolId: input.schoolId,
      calendarId: calendar._id,
      academicPeriodId: input.session.academicPeriodId,
      title,
      description: entry.instructionsForInvigilators ?? null,
      startDate,
      endDate,
      allDay: false,
      location: entry.venueId
        ? venueMap.get(String(entry.venueId)) ?? entry.roomLabel ?? null
        : entry.roomLabel ?? null,
      color: "#8b5cf6",
      status: "published" as const,
      eventType: "exam" as const,
      isNonTeachingDay: false,
      audience: {
        scope: "specific_users" as const,
        userIds: [new Types.ObjectId(teacherUserId)],
        classGroupIds: [],
        gradeIds: [],
        roles: ["teacher"],
      },
      recurrence: null,
      editorScope: "calendar" as const,
      editorIds: [],
      reminders: [],
      updatedBy: input.actorId,
    };

    const existingLink = await ExamCalendarEventLink.findOne({
      schoolId: input.schoolId,
      sourceRefKey,
    });

    if (existingLink) {
      await AcademicCalendarEvent.updateOne(
        { _id: existingLink.calendarEventId, schoolId: input.schoolId },
        { $set: payload }
      );
      existingLink.versionNumber = input.versionNumber;
      await existingLink.save();
      updatedCount += 1;
      linkedEventIds.push(String(existingLink.calendarEventId));
      continue;
    }

    const event = await AcademicCalendarEvent.create({
      ...payload,
      createdBy: input.actorId,
    });

    await ExamCalendarEventLink.create({
      schoolId: input.schoolId,
      examSessionId: input.session._id,
      calendarId: calendar._id,
      calendarEventId: event._id,
      linkKind: "invigilation",
      sourceRefId: assignment._id,
      sourceRefKey,
      versionNumber: input.versionNumber,
    });

    createdCount += 1;
    linkedEventIds.push(String(event._id));
  }

  const staleLinks = await ExamCalendarEventLink.find({
    schoolId: input.schoolId,
    examSessionId: input.session._id,
    sourceRefKey: { $nin: Array.from(activeSourceKeys) },
  });

  let cancelledCount = 0;
  for (const link of staleLinks) {
    await AcademicCalendarEvent.updateOne(
      { _id: link.calendarEventId, schoolId: input.schoolId },
      { $set: { status: "cancelled", updatedBy: input.actorId } }
    );
    await link.deleteOne();
    cancelledCount += 1;
  }

  void recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.calendar.synced",
    entityType: "ExamSession",
    entityId: input.session._id,
    description: "Exam timetable calendar events synced.",
    metadata: {
      versionNumber: input.versionNumber,
      createdCount,
      updatedCount,
      cancelledCount,
    },
  });

  return {
    examSessionId: String(input.session._id),
    calendarId: String(calendar._id),
    versionNumber: input.versionNumber,
    createdCount,
    updatedCount,
    cancelledCount,
    linkedEventIds,
  };
}
