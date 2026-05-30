import mongoose, { Types } from "mongoose";
import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "@/constants/academics/exam-scheduling-engine";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { ExamConflictSnapshot } from "@/models/ExamConflictSnapshot";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import {
  isExamMarksPendingEligible,
  TEACHER_MARKS_PENDING_ITEM_STATUSES,
} from "@/lib/exams/exam-teacher-validation";
import type {
  ExamSchedulingAnalyticsDTO,
  ExamSessionStatus,
} from "@/types/academics/exam-scheduling-engine";

export class ExamAnalyticsServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamAnalyticsServiceError";
    this.status = status;
  }
}

const ACTIVE_SESSION_STATUSES: ExamSessionStatus[] = [
  "draft",
  "scheduled",
  "conflict_review",
  "published",
  "in_progress",
  "completed",
  "locked",
];

const PUBLISHED_ENTRY_STATUSES = ["published", "in_progress", "completed", "rescheduled"];

function countActiveConflicts(rows: Array<{ severity: string; overriddenBy?: Types.ObjectId | null }>) {
  let errors = 0;
  let warnings = 0;
  for (const row of rows) {
    if (row.overriddenBy) continue;
    if (row.severity === "error") errors += 1;
    if (row.severity === "warning") warnings += 1;
  }
  return { errors, warnings };
}

async function countMarksPendingForSession(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  sessionStatus: ExamSessionStatus;
}): Promise<number> {
  const items = await AssessmentItem.find({
    schoolId: input.schoolId,
    sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
    sourceRefId: { $ne: null },
    contributesToReport: true,
    status: { $in: TEACHER_MARKS_PENDING_ITEM_STATUSES },
  })
    .select("_id sourceRefId status contributesToReport")
    .lean();

  if (!items.length) return 0;

  const entryIds = items
    .map((item) => item.sourceRefId)
    .filter(Boolean) as Types.ObjectId[];

  const entries = await ExamTimetableEntry.find({
    _id: { $in: entryIds },
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  })
    .select("_id date")
    .lean();

  const entryMap = new Map(entries.map((entry) => [String(entry._id), entry]));
  const eligibleItemIds: Types.ObjectId[] = [];

  for (const item of items) {
    const entry = entryMap.get(String(item.sourceRefId));
    if (!entry) continue;
    if (
      !isExamMarksPendingEligible({
        examDateIso: entry.date.toISOString(),
        sessionStatus: input.sessionStatus,
        assessmentItemStatus: item.status,
        contributesToReport: item.contributesToReport,
      })
    ) {
      continue;
    }
    eligibleItemIds.push(item._id);
  }

  if (!eligibleItemIds.length) return 0;

  const classGroupIds = await AssessmentItem.find({
    _id: { $in: eligibleItemIds },
  })
    .select("classGroupId")
    .lean()
    .then((rows) => rows.map((row) => row.classGroupId));

  const studentCounts = await Student.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        schoolId: input.schoolId,
        classGroupId: { $in: classGroupIds },
        status: "active",
      },
    },
    { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
  ]);

  const gradedCounts = await AssessmentScore.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        schoolId: input.schoolId,
        assessmentItemId: { $in: eligibleItemIds },
        score: { $ne: null },
      },
    },
    { $group: { _id: "$assessmentItemId", count: { $sum: 1 } } },
  ]);

  const studentCountMap = new Map(studentCounts.map((row) => [String(row._id), row.count]));
  const gradedCountMap = new Map(gradedCounts.map((row) => [String(row._id), row.count]));

  const eligibleItems = await AssessmentItem.find({ _id: { $in: eligibleItemIds } })
    .select("_id classGroupId")
    .lean();

  let pendingCount = 0;
  for (const item of eligibleItems) {
    const studentCount = studentCountMap.get(String(item.classGroupId)) ?? 0;
    const gradedCount = gradedCountMap.get(String(item._id)) ?? 0;
    if (studentCount > gradedCount) pendingCount += 1;
  }

  return pendingCount;
}

export async function getExamSchedulingAnalytics(input: {
  schoolId: Types.ObjectId;
  academicPeriodId?: string | null;
}): Promise<ExamSchedulingAnalyticsDTO> {
  const sessionFilter: Record<string, unknown> = {
    schoolId: input.schoolId,
    status: { $in: ACTIVE_SESSION_STATUSES },
  };

  if (input.academicPeriodId) {
    if (!mongoose.Types.ObjectId.isValid(input.academicPeriodId)) {
      throw new ExamAnalyticsServiceError("Invalid academic period id.", 400);
    }
    sessionFilter.academicPeriodId = new Types.ObjectId(input.academicPeriodId);
  }

  const sessions = await ExamSession.find(sessionFilter)
    .select("_id name status")
    .sort({ startDate: -1 })
    .lean();

  if (!sessions.length) {
    return {
      generatedAt: new Date().toISOString(),
      academicPeriodId: input.academicPeriodId ?? null,
      summary: {
        activeSessionCount: 0,
        totalPapers: 0,
        publishedPapers: 0,
        unscheduledPapers: 0,
        openConflictErrors: 0,
        openConflictWarnings: 0,
        marksPendingPapers: 0,
      },
      invigilationWorkload: [],
      sessionHighlights: [],
    };
  }

  const sessionIds = sessions.map((session) => session._id);

  const [entryStats, snapshots, invigilatorRows, marksPendingBySession] = await Promise.all([
    ExamTimetableEntry.aggregate<{
      _id: Types.ObjectId;
      total: number;
      published: number;
      unscheduled: number;
    }>([
      { $match: { schoolId: input.schoolId, examSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: "$examSessionId",
          total: { $sum: 1 },
          published: {
            $sum: {
              $cond: [{ $in: ["$status", PUBLISHED_ENTRY_STATUSES] }, 1, 0],
            },
          },
          unscheduled: {
            $sum: { $cond: ["$isUnscheduled", 1, 0] },
          },
        },
      },
    ]),
    ExamConflictSnapshot.aggregate<{
      _id: Types.ObjectId;
      conflicts: Array<{ severity: string; overriddenBy?: Types.ObjectId | null }>;
    }>([
      { $match: { schoolId: input.schoolId, examSessionId: { $in: sessionIds } } },
      { $sort: { generatedAt: -1 } },
      {
        $group: {
          _id: "$examSessionId",
          conflicts: { $first: "$conflicts" },
        },
      },
    ]),
    ExamInvigilatorAssignment.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          schoolId: input.schoolId,
          examSessionId: { $in: sessionIds },
          status: { $in: ["assigned", "acknowledged", "completed"] },
        },
      },
      { $group: { _id: "$teacherId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Promise.all(
      sessions.map(async (session) => ({
        sessionId: String(session._id),
        count: await countMarksPendingForSession({
          schoolId: input.schoolId,
          sessionId: session._id,
          sessionStatus: session.status,
        }),
      }))
    ),
  ]);

  const entryStatsMap = new Map(entryStats.map((row) => [String(row._id), row]));
  const snapshotMap = new Map(snapshots.map((row) => [String(row._id), row.conflicts ?? []]));
  const marksPendingMap = new Map(marksPendingBySession.map((row) => [row.sessionId, row.count]));

  const teacherIds = invigilatorRows.map((row) => row._id);
  const teachers = teacherIds.length
    ? await Teacher.find({ _id: { $in: teacherIds }, schoolId: input.schoolId })
        .select("_id userId")
        .lean()
    : [];
  const userIds = teachers.map((teacher) => teacher.userId).filter(Boolean) as Types.ObjectId[];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("_id firstName lastName").lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const teacherNameMap = new Map<string, string | null>();
  for (const teacher of teachers) {
    const user = teacher.userId ? userMap.get(String(teacher.userId)) : null;
    teacherNameMap.set(
      String(teacher._id),
      user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null : null
    );
  }

  let totalPapers = 0;
  let publishedPapers = 0;
  let unscheduledPapers = 0;
  let openConflictErrors = 0;
  let openConflictWarnings = 0;
  let marksPendingPapers = 0;

  const sessionHighlights = sessions.map((session) => {
    const stats = entryStatsMap.get(String(session._id));
    const conflictCounts = countActiveConflicts(snapshotMap.get(String(session._id)) ?? []);
    const sessionMarksPending = marksPendingMap.get(String(session._id)) ?? 0;

    totalPapers += stats?.total ?? 0;
    publishedPapers += stats?.published ?? 0;
    unscheduledPapers += stats?.unscheduled ?? 0;
    openConflictErrors += conflictCounts.errors;
    openConflictWarnings += conflictCounts.warnings;
    marksPendingPapers += sessionMarksPending;

    return {
      sessionId: String(session._id),
      sessionName: session.name,
      status: session.status,
      totalPapers: stats?.total ?? 0,
      publishedPapers: stats?.published ?? 0,
      conflictErrors: conflictCounts.errors,
      conflictWarnings: conflictCounts.warnings,
      marksPendingPapers: sessionMarksPending,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    academicPeriodId: input.academicPeriodId ?? null,
    summary: {
      activeSessionCount: sessions.length,
      totalPapers,
      publishedPapers,
      unscheduledPapers,
      openConflictErrors,
      openConflictWarnings,
      marksPendingPapers,
    },
    invigilationWorkload: invigilatorRows.map((row) => ({
      teacherId: String(row._id),
      teacherName: teacherNameMap.get(String(row._id)) ?? null,
      assignmentCount: row.count,
    })),
    sessionHighlights,
  };
}
