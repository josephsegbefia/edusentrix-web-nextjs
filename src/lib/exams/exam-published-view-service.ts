import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamTimetableVersion } from "@/models/ExamTimetableVersion";
import { ExamVenue } from "@/models/ExamVenue";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import type { PublishedExamTimetableDTO, PublishedExamTimetableEntryDTO } from "@/types/academics/exam-scheduling-engine";
import {
  TEACHER_TIMETABLE_ENTRY_STATUSES,
  TEACHER_VISIBLE_EXAM_SESSION_STATUSES,
} from "@/lib/exams/exam-teacher-validation";

export class ExamPublishedViewServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamPublishedViewServiceError";
    this.status = status;
  }
}

async function resolveCurrentPeriod(schoolId: Types.ObjectId) {
  const period = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean();

  if (!period) {
    throw new ExamPublishedViewServiceError("No active academic period found.", 404);
  }

  return period;
}

async function loadLatestPublishedVersions(input: {
  schoolId: Types.ObjectId;
  sessionIds: Types.ObjectId[];
}) {
  if (!input.sessionIds.length) return new Map<string, { versionNumber: number; publishedAt: Date; changeSummary: string }>();

  const versions = await ExamTimetableVersion.find({
    schoolId: input.schoolId,
    examSessionId: { $in: input.sessionIds },
    status: "published",
  })
    .sort({ versionNumber: -1 })
    .lean();

  const map = new Map<string, { versionNumber: number; publishedAt: Date; changeSummary: string }>();
  for (const version of versions) {
    const key = String(version.examSessionId);
    if (!map.has(key)) {
      map.set(key, {
        versionNumber: version.versionNumber,
        publishedAt: version.publishedAt,
        changeSummary: version.changeSummary,
      });
    }
  }
  return map;
}

export async function getPublishedExamTimetableForStudent(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
}): Promise<PublishedExamTimetableDTO> {
  const student = await Student.findOne({
    _id: input.studentId,
    schoolId: input.schoolId,
    status: "active",
  })
    .select("_id classGroupId")
    .lean();

  if (!student?.classGroupId) {
    throw new ExamPublishedViewServiceError("Student class group not found.", 404);
  }

  const period = input.academicPeriodId
    ? await AcademicPeriod.findOne({
        _id: input.academicPeriodId,
        schoolId: input.schoolId,
      })
        .select("_id")
        .lean()
    : await resolveCurrentPeriod(input.schoolId);

  if (!period) {
    throw new ExamPublishedViewServiceError("Academic period not found.", 404);
  }

  const classGroup = await ClassGroup.findOne({
    _id: student.classGroupId,
    schoolId: input.schoolId,
  })
    .select("name")
    .lean();

  const sessions = await ExamSession.find({
    schoolId: input.schoolId,
    academicPeriodId: period._id,
    allowParentStudentVisibility: true,
    status: { $in: TEACHER_VISIBLE_EXAM_SESSION_STATUSES },
  })
    .select("_id name examType status publishedAt")
    .lean();

  if (!sessions.length) {
    return {
      studentId: String(student._id),
      classGroupId: String(student.classGroupId),
      classGroupName: classGroup?.name ?? null,
      academicPeriodId: String(period._id),
      entries: [],
      lastUpdatedAt: null,
      latestVersionNumber: null,
    };
  }

  const sessionIds = sessions.map((session) => session._id);
  const sessionMap = new Map(
    sessions.map((session) => [
      String(session._id),
      { name: session.name, examType: session.examType, publishedAt: session.publishedAt },
    ])
  );

  const [entries, versionMap] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: { $in: sessionIds },
      classGroupIds: student.classGroupId,
      status: { $in: TEACHER_TIMETABLE_ENTRY_STATUSES },
      isUnscheduled: false,
    })
      .sort({ date: 1, startTime: 1 })
      .lean(),
    loadLatestPublishedVersions({ schoolId: input.schoolId, sessionIds }),
  ]);

  const subjectIds = entries.map((entry) => entry.subjectId);
  const venueIds = entries
    .map((entry) => entry.venueId)
    .filter((value): value is Types.ObjectId => Boolean(value));

  const [subjects, venues] = await Promise.all([
    subjectIds.length
      ? Subject.find({ _id: { $in: subjectIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
    venueIds.length
      ? ExamVenue.find({ _id: { $in: venueIds }, schoolId: input.schoolId }).select("name").lean()
      : Promise.resolve([]),
  ]);

  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));
  const venueMap = new Map(venues.map((row) => [String(row._id), row.name]));

  const publishedEntries = entries.map((entry) => {
    const session = sessionMap.get(String(entry.examSessionId));
    const version = versionMap.get(String(entry.examSessionId));
    return {
      entryId: String(entry._id),
      examSessionId: String(entry.examSessionId),
      examSessionName: session?.name ?? "Exam session",
      examType: (session?.examType ?? "other") as PublishedExamTimetableEntryDTO["examType"],
      title: entry.title ?? null,
      subjectId: String(entry.subjectId),
      subjectName: subjectMap.get(String(entry.subjectId)) ?? null,
      classGroupNames: classGroup?.name ? [classGroup.name] : [],
      date: entry.date.toISOString(),
      startTime: entry.startTime,
      endTime: entry.endTime,
      venueName: entry.venueId ? venueMap.get(String(entry.venueId)) ?? null : null,
      roomLabel: entry.roomLabel ?? null,
      instructionsForStudents: entry.instructionsForStudents ?? null,
      materialsAllowed: entry.materialsAllowed ?? [],
      status: entry.status,
      version: version
        ? {
            versionNumber: version.versionNumber,
            publishedAt: version.publishedAt.toISOString(),
            changeSummary: version.changeSummary,
          }
        : null,
    };
  });

  const versionNumbers = Array.from(versionMap.values()).map((row) => row.versionNumber);
  const latestVersionNumber = versionNumbers.length ? Math.max(...versionNumbers) : null;
  const versionDates = Array.from(versionMap.values()).map((row) => row.publishedAt.getTime());
  const sessionDates = sessions
    .map((session) => session.publishedAt?.getTime())
    .filter((value): value is number => typeof value === "number");
  const allDates = [...versionDates, ...sessionDates];
  const lastUpdatedAt =
    allDates.length > 0 ? new Date(Math.max(...allDates)).toISOString() : null;

  return {
    studentId: String(student._id),
    classGroupId: String(student.classGroupId),
    classGroupName: classGroup?.name ?? null,
    academicPeriodId: String(period._id),
    entries: publishedEntries,
    lastUpdatedAt,
    latestVersionNumber,
  };
}

export async function getPublishedExamTimetableForWard(input: {
  schoolId: Types.ObjectId;
  wardId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
}): Promise<PublishedExamTimetableDTO> {
  const student = await Student.findOne({
    _id: input.wardId,
    schoolId: input.schoolId,
    status: "active",
  })
    .select("_id")
    .lean();

  if (!student) {
    throw new ExamPublishedViewServiceError("Student not found.", 404);
  }

  return getPublishedExamTimetableForStudent({
    schoolId: input.schoolId,
    studentId: student._id as Types.ObjectId,
    academicPeriodId: input.academicPeriodId,
  });
}
