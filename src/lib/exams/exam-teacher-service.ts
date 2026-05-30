import { Types } from "mongoose";
import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "@/constants/academics/exam-scheduling-engine";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import type {
  TeacherExamInvigilationDutyDTO,
  TeacherExamMarksPendingDTO,
  TeacherExamSummaryDTO,
  TeacherExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";
import { serializeExamInvigilatorAssignment } from "@/lib/exams/exam-invigilator-service";
import { buildTeacherExamDayOps } from "@/lib/exams/exam-day-operations-service";
import {
  TEACHER_ACTIVE_INVIGILATOR_STATUSES,
  TEACHER_EXCLUDED_EXAM_SESSION_STATUSES,
  TEACHER_MARKS_PENDING_ITEM_STATUSES,
  TEACHER_TIMETABLE_ENTRY_STATUSES,
  TEACHER_VISIBLE_EXAM_SESSION_STATUSES,
  computeMissingScoreCount,
  isExamMarksPendingEligible,
  startOfLocalDay,
  teacherTeachesExamEntry,
} from "@/lib/exams/exam-teacher-validation";

export class ExamTeacherServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamTeacherServiceError";
    this.status = status;
  }
}

type NameMaps = {
  subjects: Map<string, string>;
  classGroups: Map<string, string>;
  venues: Map<string, string>;
  sessions: Map<string, { name: string; status: string; examType: string }>;
};

async function resolveCurrentPeriod(schoolId: Types.ObjectId) {
  const period = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean();

  if (!period) {
    throw new ExamTeacherServiceError("No active academic period found.", 404);
  }

  return period;
}

async function loadTeacherAssignmentKeys(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
}) {
  const assignments = await TeacherAssignment.find({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    academicPeriodId: input.academicPeriodId,
    status: "active",
  })
    .select("classGroupId subjectId")
    .lean();

  return new Set(
    assignments
      .filter((assignment) => assignment.classGroupId && assignment.subjectId)
      .map(
        (assignment) => `${String(assignment.classGroupId)}|${String(assignment.subjectId)}`
      )
  );
}

async function loadNameMaps(input: {
  schoolId: Types.ObjectId;
  subjectIds: Types.ObjectId[];
  classGroupIds: Types.ObjectId[];
  venueIds: Types.ObjectId[];
  sessionIds: Types.ObjectId[];
}): Promise<NameMaps> {
  const [subjects, classGroups, venues, sessions] = await Promise.all([
    input.subjectIds.length
      ? Subject.find({ _id: { $in: input.subjectIds }, schoolId: input.schoolId })
          .select("name")
          .lean()
      : Promise.resolve([]),
    input.classGroupIds.length
      ? ClassGroup.find({ _id: { $in: input.classGroupIds }, schoolId: input.schoolId })
          .select("name")
          .lean()
      : Promise.resolve([]),
    input.venueIds.length
      ? ExamVenue.find({ _id: { $in: input.venueIds }, schoolId: input.schoolId })
          .select("name")
          .lean()
      : Promise.resolve([]),
    input.sessionIds.length
      ? ExamSession.find({ _id: { $in: input.sessionIds }, schoolId: input.schoolId })
          .select("name status examType")
          .lean()
      : Promise.resolve([]),
  ]);

  return {
    subjects: new Map(subjects.map((row) => [String(row._id), row.name])),
    classGroups: new Map(classGroups.map((row) => [String(row._id), row.name])),
    venues: new Map(venues.map((row) => [String(row._id), row.name])),
    sessions: new Map(
      sessions.map((row) => [
        String(row._id),
        { name: row.name, status: row.status, examType: row.examType },
      ])
    ),
  };
}

function mapClassGroupNames(classGroupIds: Types.ObjectId[], names: Map<string, string>) {
  return classGroupIds.map((id) => names.get(String(id)) ?? null).filter(Boolean) as string[];
}

export async function listTeacherInvigilationDuties(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
}): Promise<TeacherExamInvigilationDutyDTO[]> {
  const assignments = await ExamInvigilatorAssignment.find({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    status: { $in: TEACHER_ACTIVE_INVIGILATOR_STATUSES },
  })
    .sort({ assignedAt: -1 })
    .lean();

  if (!assignments.length) return [];

  const entryIds = Array.from(
    new Set(assignments.map((assignment) => String(assignment.examTimetableEntryId)))
  ).map((id) => new Types.ObjectId(id));

  const entries = await ExamTimetableEntry.find({
    _id: { $in: entryIds },
    schoolId: input.schoolId,
  }).lean();

  const entryMap = new Map(entries.map((entry) => [String(entry._id), entry]));
  const sessionIds = Array.from(
    new Set(entries.map((entry) => String(entry.examSessionId)))
  ).map((id) => new Types.ObjectId(id));

  const sessions = await ExamSession.find({
    _id: { $in: sessionIds },
    schoolId: input.schoolId,
    status: { $nin: TEACHER_EXCLUDED_EXAM_SESSION_STATUSES },
  })
    .select("_id name status")
    .lean();

  const visibleSessionIds = new Set(sessions.map((session) => String(session._id)));

  const subjectIds = entries.map((entry) => entry.subjectId);
  const classGroupIds = entries.flatMap((entry) => entry.classGroupIds);
  const venueIds = entries
    .map((entry) => entry.venueId)
    .filter((value): value is Types.ObjectId => Boolean(value));

  const names = await loadNameMaps({
    schoolId: input.schoolId,
    subjectIds,
    classGroupIds,
    venueIds,
    sessionIds,
  });

  return assignments
    .map((assignment) => {
      const entry = entryMap.get(String(assignment.examTimetableEntryId));
      if (!entry || !visibleSessionIds.has(String(entry.examSessionId))) {
        return null;
      }

      const session = names.sessions.get(String(entry.examSessionId));
      if (!session) return null;

      return {
        assignment: serializeExamInvigilatorAssignment(assignment),
        examSessionId: String(entry.examSessionId),
        examSessionName: session.name,
        examSessionStatus: session.status as TeacherExamInvigilationDutyDTO["examSessionStatus"],
        entryId: String(entry._id),
        entryTitle: entry.title ?? null,
        subjectId: String(entry.subjectId),
        subjectName: names.subjects.get(String(entry.subjectId)) ?? null,
        classGroupIds: entry.classGroupIds.map(String),
        classGroupNames: mapClassGroupNames(entry.classGroupIds, names.classGroups),
        date: entry.date.toISOString(),
        startTime: entry.startTime,
        endTime: entry.endTime,
        venueId: entry.venueId ? String(entry.venueId) : null,
        venueName: entry.venueId ? names.venues.get(String(entry.venueId)) ?? null : null,
        roomLabel: entry.roomLabel ?? null,
        instructionsForInvigilators: entry.instructionsForInvigilators ?? null,
        canAcknowledge: assignment.status === "assigned",
        entryStatus: entry.status,
        dayOps: {
          ...buildTeacherExamDayOps(entry.status),
          entryId: String(entry._id),
        },
      } satisfies TeacherExamInvigilationDutyDTO;
    })
    .filter(Boolean) as TeacherExamInvigilationDutyDTO[];
}

export async function listTeacherExamTimetable(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
}): Promise<TeacherExamTimetableEntryDTO[]> {
  const period = await resolveCurrentPeriod(input.schoolId);
  const assignmentKeys = await loadTeacherAssignmentKeys({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    academicPeriodId: period._id as Types.ObjectId,
  });

  if (!assignmentKeys.size) return [];

  const classGroupIds = Array.from(assignmentKeys).map((key) => key.split("|")[0]!);
  const subjectIds = Array.from(assignmentKeys).map((key) => key.split("|")[1]!);

  const sessions = await ExamSession.find({
    schoolId: input.schoolId,
    academicPeriodId: period._id,
    status: { $in: TEACHER_VISIBLE_EXAM_SESSION_STATUSES },
  })
    .select("_id name examType status")
    .lean();

  if (!sessions.length) return [];

  const sessionIds = sessions.map((session) => session._id);
  const entries = await ExamTimetableEntry.find({
    schoolId: input.schoolId,
    examSessionId: { $in: sessionIds },
    subjectId: { $in: subjectIds.map((id) => new Types.ObjectId(id)) },
    classGroupIds: {
      $in: classGroupIds.map((id) => new Types.ObjectId(id)),
    },
    status: { $in: TEACHER_TIMETABLE_ENTRY_STATUSES },
    isUnscheduled: false,
  })
    .sort({ date: 1, startTime: 1 })
    .lean();

  const visibleEntries = entries.filter((entry) =>
    teacherTeachesExamEntry({
      subjectId: String(entry.subjectId),
      classGroupIds: entry.classGroupIds.map(String),
      assignmentKeys,
    })
  );

  if (!visibleEntries.length) return [];

  const names = await loadNameMaps({
    schoolId: input.schoolId,
    subjectIds: visibleEntries.map((entry) => entry.subjectId),
    classGroupIds: visibleEntries.flatMap((entry) => entry.classGroupIds),
    venueIds: visibleEntries
      .map((entry) => entry.venueId)
      .filter((value): value is Types.ObjectId => Boolean(value)),
    sessionIds: visibleEntries.map((entry) => entry.examSessionId),
  });

  return visibleEntries.map((entry) => {
    const session = names.sessions.get(String(entry.examSessionId));
    return {
      entryId: String(entry._id),
      examSessionId: String(entry.examSessionId),
      examSessionName: session?.name ?? "Exam session",
      examType: (session?.examType ?? "other") as TeacherExamTimetableEntryDTO["examType"],
      title: entry.title ?? null,
      subjectId: String(entry.subjectId),
      subjectName: names.subjects.get(String(entry.subjectId)) ?? null,
      classGroupIds: entry.classGroupIds.map(String),
      classGroupNames: mapClassGroupNames(entry.classGroupIds, names.classGroups),
      date: entry.date.toISOString(),
      startTime: entry.startTime,
      endTime: entry.endTime,
      venueId: entry.venueId ? String(entry.venueId) : null,
      venueName: entry.venueId ? names.venues.get(String(entry.venueId)) ?? null : null,
      roomLabel: entry.roomLabel ?? null,
      instructionsForStudents: entry.instructionsForStudents ?? null,
      status: entry.status,
    };
  });
}

export async function listTeacherExamMarksPending(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
}): Promise<TeacherExamMarksPendingDTO[]> {
  const items = await AssessmentItem.find({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
    sourceRefId: { $ne: null },
    contributesToReport: true,
    status: { $in: TEACHER_MARKS_PENDING_ITEM_STATUSES },
  }).lean();

  if (!items.length) return [];

  const entryIds = Array.from(
    new Set(items.map((item) => String(item.sourceRefId)).filter(Boolean))
  ).map((id) => new Types.ObjectId(id));

  const entries = await ExamTimetableEntry.find({
    _id: { $in: entryIds },
    schoolId: input.schoolId,
  }).lean();

  const entryMap = new Map(entries.map((entry) => [String(entry._id), entry]));
  const sessionIds = Array.from(new Set(entries.map((entry) => String(entry.examSessionId)))).map(
    (id) => new Types.ObjectId(id)
  );

  const sessions = await ExamSession.find({
    _id: { $in: sessionIds },
    schoolId: input.schoolId,
  })
    .select("_id name status")
    .lean();

  const sessionMap = new Map(sessions.map((session) => [String(session._id), session]));

  const eligibleItems = items.filter((item) => {
    const entry = entryMap.get(String(item.sourceRefId));
    if (!entry) return false;
    const session = sessionMap.get(String(entry.examSessionId));
    if (!session) return false;
    return isExamMarksPendingEligible({
      examDateIso: entry.date.toISOString(),
      sessionStatus: session.status,
      assessmentItemStatus: item.status,
      contributesToReport: item.contributesToReport,
    });
  });

  if (!eligibleItems.length) return [];

  const itemIds = eligibleItems.map((item) => item._id);
  const classGroupIds = eligibleItems.map((item) => item.classGroupId);
  const subjectIds = eligibleItems.map((item) => item.subjectId);

  const [studentCounts, gradedCounts, names] = await Promise.all([
    Student.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          schoolId: input.schoolId,
          classGroupId: { $in: classGroupIds },
          status: "active",
        },
      },
      { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
    ]),
    AssessmentScore.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          schoolId: input.schoolId,
          assessmentItemId: { $in: itemIds },
          score: { $ne: null },
        },
      },
      { $group: { _id: "$assessmentItemId", count: { $sum: 1 } } },
    ]),
    loadNameMaps({
      schoolId: input.schoolId,
      subjectIds,
      classGroupIds,
      venueIds: [],
      sessionIds: eligibleItems
        .map((item) => entryMap.get(String(item.sourceRefId))?.examSessionId)
        .filter((value): value is Types.ObjectId => Boolean(value)),
    }),
  ]);

  const studentCountMap = new Map(studentCounts.map((row) => [String(row._id), row.count]));
  const gradedCountMap = new Map(gradedCounts.map((row) => [String(row._id), row.count]));

  return eligibleItems
    .map((item) => {
      const entry = entryMap.get(String(item.sourceRefId));
      if (!entry) return null;

      const session = sessionMap.get(String(entry.examSessionId));
      const studentCount = studentCountMap.get(String(item.classGroupId)) ?? 0;
      const gradedCount = gradedCountMap.get(String(item._id)) ?? 0;
      const missingScoreCount = computeMissingScoreCount({ studentCount, gradedCount });

      if (missingScoreCount <= 0) return null;

      return {
        assessmentItemId: String(item._id),
        assessmentItemTitle: item.title,
        assessmentItemStatus: item.status,
        maxScore: item.maxScore,
        classGroupId: String(item.classGroupId),
        classGroupName: names.classGroups.get(String(item.classGroupId)) ?? null,
        subjectId: String(item.subjectId),
        subjectName: names.subjects.get(String(item.subjectId)) ?? null,
        examEntryId: String(entry._id),
        examSessionId: String(entry.examSessionId),
        examSessionName: session?.name ?? "Exam session",
        examDate: entry.date.toISOString(),
        examStartTime: entry.startTime,
        studentCount,
        missingScoreCount,
        gradebookPath: `/teacher/marks/${String(item.classGroupId)}/${String(item.subjectId)}`,
      } satisfies TeacherExamMarksPendingDTO;
    })
    .filter(Boolean) as TeacherExamMarksPendingDTO[];
}

export async function getTeacherExamSummary(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
}): Promise<TeacherExamSummaryDTO> {
  const [duties, timetable, marksPending] = await Promise.all([
    listTeacherInvigilationDuties(input),
    listTeacherExamTimetable(input),
    listTeacherExamMarksPending(input),
  ]);

  const today = startOfLocalDay(new Date());
  const upcomingTimetableCount = timetable.filter((entry) => {
    const entryDate = startOfLocalDay(new Date(entry.date));
    return entryDate.getTime() >= today.getTime();
  }).length;

  return {
    upcomingTimetableCount,
    pendingAcknowledgementCount: duties.filter((duty) => duty.canAcknowledge).length,
    marksPendingCount: marksPending.length,
  };
}
