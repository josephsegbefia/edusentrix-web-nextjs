import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getStudentLearnAccess } from "@/lib/learn/access";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { findCoveredLessonSessions } from "@/lib/learn/covered-lesson-sessions";
import { generateDailyQuestBoardForStudent } from "@/lib/learn/daily-quest";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import {
  LearnSubjectJourney,
  type ILearnSubjectJourney,
} from "@/models/LearnSubjectJourney";
import { Homework } from "@/models/Homework";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

import {
  buildDefaultJourneySteps,
  computeJourneyCompletion,
  dateKeyForSchoolDay,
  deriveJourneyStatus,
  JOURNEY_TIMEZONE,
  mergeJourneySteps,
} from "./journey-step-utils";
import { serializeTodayJourney, type MobileJourneyAssignmentSummary } from "./serialize-todays-journey";

type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  scheduledDate: Date;
  ownerTeacherId?: Types.ObjectId | null;
  learnTeacherPriority?: boolean;
};

type HomeworkSummaryRow = {
  _id: Types.ObjectId;
  title: string;
  subjectId: Types.ObjectId;
  dueDate: Date;
  status: string;
};

const MAX_CATCH_UP = 2;

async function resolveOfferingMap(schoolId: Types.ObjectId, offeringIds: Types.ObjectId[]) {
  if (offeringIds.length === 0) return new Map<string, string>();

  const offerings = await SubjectOffering.find({
    _id: { $in: offeringIds },
    schoolId,
  })
    .select("displayName shortName")
    .lean<Array<{ _id: Types.ObjectId; displayName?: string; shortName?: string }>>();

  return new Map(
    offerings.map((row) => [String(row._id), row.shortName || row.displayName || "Subject"])
  );
}

async function teacherDisplayName(teacherId: Types.ObjectId) {
  const teacher = await Teacher.findById(teacherId)
    .select("userId")
    .lean<{ userId?: Types.ObjectId } | null>();
  if (!teacher?.userId) return "Your teacher";

  const user = await User.findById(teacher.userId)
    .select("firstName lastName name")
    .lean<{ firstName?: string; lastName?: string; name?: string } | null>();
  if (!user) return "Your teacher";

  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return parts || user.name?.trim() || "Your teacher";
}

async function findPublishedDeck(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  return LessonFlashcardDeck.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    status: "published",
    generatedForStudentId: null,
    publishToClassGroupIds: input.classGroupId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
}

async function findSessionAssignmentIds(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  const rows = await Homework.find({
    schoolId: input.schoolId,
    sourceSessionId: input.sessionId,
    status: "published",
    classGroupIds: input.classGroupId,
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  return rows.map((row) => row._id);
}

async function upsertJourneyForSession(input: {
  context: LearnMobileStudentContext;
  session: SessionRow;
  dateKey: string;
  displayOrder: number;
  boardId: Types.ObjectId | null;
  offeringMap: Map<string, string>;
  isCatchUp?: boolean;
  sourceJourney?: ILearnSubjectJourney;
}) {
  const { context, session, dateKey, displayOrder, boardId, offeringMap } = input;
  const subjectName =
    (session.subjectOfferingId
      ? offeringMap.get(String(session.subjectOfferingId))
      : undefined) || "Subject";

  const teacherName = session.ownerTeacherId
    ? await teacherDisplayName(session.ownerTeacherId)
    : null;

  const deck = await findPublishedDeck({
    schoolId: context.schoolId,
    sessionId: session._id,
    classGroupId: context.classGroupId!,
  });
  const assignmentIds = await findSessionAssignmentIds({
    schoolId: context.schoolId,
    sessionId: session._id,
    classGroupId: context.classGroupId!,
  });

  const basePriority = input.isCatchUp ? 40 : 100 - displayOrder;
  const priorityScore = session.learnTeacherPriority ? basePriority + 15 : basePriority;
  const priorityReason = session.learnTeacherPriority
    ? "teacher_priority"
    : input.isCatchUp
      ? "started_but_incomplete"
      : "taught_today";

  const defaultSteps = buildDefaultJourneySteps({
    hasFlashcards: deck != null,
    hasAssignment: assignmentIds.length > 0,
  });

  const existing = await LearnSubjectJourney.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    lessonSessionId: session._id,
    date: dateKey,
  }).lean<ILearnSubjectJourney | null>();

  const steps = existing ? mergeJourneySteps(existing.steps, defaultSteps) : defaultSteps;
  const metrics = computeJourneyCompletion(steps);
  const status = deriveJourneyStatus({
    status: existing?.status ?? "available",
    completionPercent: metrics.completionPercent,
    steps,
  });

  const catchUp = input.isCatchUp
    ? {
        isCatchUp: true,
        sourceJourneyId: input.sourceJourney?._id ?? null,
        savedAt: input.sourceJourney?.catchUp.savedAt ?? new Date(),
        carryCount: (input.sourceJourney?.catchUp.carryCount ?? 0) + 1,
      }
    : { isCatchUp: false, carryCount: 0 };

  await LearnSubjectJourney.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      lessonSessionId: session._id,
      date: dateKey,
    },
    {
      $set: {
        accountId: context.accountId,
        classGroupId: context.classGroupId,
        gradeId: context.gradeId,
        timezone: JOURNEY_TIMEZONE,
        boardId,
        subjectOfferingId: session.subjectOfferingId ?? null,
        subjectId: session.subjectId ?? null,
        subjectName,
        topicTitle: session.title,
        teacherId: session.ownerTeacherId ?? null,
        teacherName,
        coveredAt: session.scheduledDate,
        status,
        required: !input.isCatchUp,
        displayOrder,
        priorityScore,
        priorityReason,
        steps,
        linkedFlashcardDeckId: deck?._id ?? existing?.linkedFlashcardDeckId ?? null,
        linkedAssignmentIds: assignmentIds.length > 0 ? assignmentIds : existing?.linkedAssignmentIds ?? [],
        completionPercent: metrics.completionPercent,
        xpEarned: metrics.xpEarned,
        totalXpAvailable: metrics.totalXpAvailable,
        catchUp,
      },
      $setOnInsert: {
        schoolId: context.schoolId,
        studentId: context.studentId,
        lessonSessionId: session._id,
        date: dateKey,
        masterySignal: {
          confidence: "unknown",
          weakConcepts: [],
          misconceptionTags: [],
        },
      },
    },
    { upsert: true, new: true }
  );
}

async function attachCatchUpJourneys(
  context: LearnMobileStudentContext,
  dateKey: string,
  todaySessionIds: Set<string>
) {
  const existingCatchUp = await LearnSubjectJourney.countDocuments({
    schoolId: context.schoolId,
    studentId: context.studentId,
    date: dateKey,
    "catchUp.isCatchUp": true,
  });

  if (existingCatchUp >= MAX_CATCH_UP) return;

  const incomplete = await LearnSubjectJourney.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    date: { $lt: dateKey },
    completionPercent: { $lt: 100 },
    status: { $in: ["available", "not_started", "in_progress", "saved_for_later"] },
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_CATCH_UP - existingCatchUp + todaySessionIds.size)
    .lean<ILearnSubjectJourney[]>();

  const offeringMap = await resolveOfferingMap(
    context.schoolId,
    [
      ...new Set(
        incomplete
          .map((journey) => journey.subjectOfferingId)
          .filter((id): id is Types.ObjectId => id != null)
          .map(String)
      ),
    ].map((id) => new Types.ObjectId(id))
  );

  let added = 0;
  for (const source of incomplete) {
    if (added >= MAX_CATCH_UP - existingCatchUp) break;
    const sessionId = String(source.lessonSessionId);
    if (todaySessionIds.has(sessionId)) continue;

    const alreadyToday = await LearnSubjectJourney.findOne({
      schoolId: context.schoolId,
      studentId: context.studentId,
      lessonSessionId: source.lessonSessionId,
      date: dateKey,
    }).lean<ILearnSubjectJourney | null>();

    if (alreadyToday) continue;

    added += 1;
    await upsertJourneyForSession({
      context,
      session: {
        _id: source.lessonSessionId,
        title: source.topicTitle,
        subjectOfferingId: source.subjectOfferingId,
        subjectId: source.subjectId,
        scheduledDate: source.coveredAt,
        ownerTeacherId: source.teacherId,
      },
      dateKey,
      displayOrder: 100 + added,
      boardId: source.boardId ?? null,
      offeringMap,
      isCatchUp: true,
      sourceJourney: source,
    });
  }
}

function formatDueLabel(dueDate: Date) {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

async function loadAssignmentsDueSoon(
  context: LearnMobileStudentContext
): Promise<MobileJourneyAssignmentSummary[]> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 3);

  const rows = await Homework.find({
    schoolId: context.schoolId,
    status: "published",
    classGroupIds: context.classGroupId,
    dueDate: { $gte: now, $lte: horizon },
  })
    .sort({ dueDate: 1 })
    .limit(5)
    .lean<HomeworkSummaryRow[]>();

  if (rows.length === 0) return [];

  const subjectIds = [...new Set(rows.map((row) => String(row.subjectId)))].map(
    (id) => new Types.ObjectId(id)
  );
  const subjects = await Subject.find({ _id: { $in: subjectIds }, schoolId: context.schoolId })
    .select("name")
    .lean<Array<{ _id: Types.ObjectId; name?: string }>>();

  const subjectMap = new Map(
    subjects.map((row) => [String(row._id), row.name || "Subject"])
  );

  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    subjectName: subjectMap.get(String(row.subjectId)) || "Subject",
    dueLabel: formatDueLabel(row.dueDate),
    dueAt: row.dueDate.toISOString(),
    status: row.dueDate < now ? "overdue" : "not_started",
    route: `/(student)/assignments/${String(row._id)}`,
  }));
}

export async function generateTodaysJourney(context: LearnMobileStudentContext) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const now = new Date();
  const dateKey = dateKeyForSchoolDay(now, JOURNEY_TIMEZONE);

  let boardId: Types.ObjectId | null = null;
  try {
    const boardResult = await generateDailyQuestBoardForStudent({
      schoolId: context.schoolId,
      studentId: context.studentId,
      userId: context.accountId,
      classGroupId: context.classGroupId,
      gradeId: context.gradeId,
    });
    boardId = boardResult.board._id;
  } catch {
    boardId = null;
  }

  const since = new Date(now);
  since.setDate(since.getDate() - 14);

  const sessions = await findCoveredLessonSessions<SessionRow>({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since,
    limit: 40,
    select: "_id title subjectOfferingId subjectId scheduledDate ownerTeacherId",
  });

  const todaySessions = sessions.filter(
    (session) =>
      dateKeyForSchoolDay(new Date(session.scheduledDate), JOURNEY_TIMEZONE) === dateKey
  );

  const offeringIds = [
    ...new Set(
      todaySessions
        .map((session) => session.subjectOfferingId)
        .filter((id): id is Types.ObjectId => id != null)
        .map(String)
    ),
  ].map((id) => new Types.ObjectId(id));

  const offeringMap = await resolveOfferingMap(context.schoolId, offeringIds);

  for (let index = 0; index < todaySessions.length; index += 1) {
    await upsertJourneyForSession({
      context,
      session: todaySessions[index],
      dateKey,
      displayOrder: index + 1,
      boardId,
      offeringMap,
    });
  }

  const todaySessionIds = new Set(todaySessions.map((session) => String(session._id)));
  await attachCatchUpJourneys(context, dateKey, todaySessionIds);

  const journeys = await LearnSubjectJourney.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    date: dateKey,
    "catchUp.isCatchUp": false,
  })
    .sort({ displayOrder: 1 })
    .lean<ILearnSubjectJourney[]>();

  const catchUpJourneys = await LearnSubjectJourney.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    date: dateKey,
    "catchUp.isCatchUp": true,
  })
    .sort({ displayOrder: 1 })
    .limit(MAX_CATCH_UP)
    .lean<ILearnSubjectJourney[]>();

  const assignmentsDueSoon = await loadAssignmentsDueSoon(context);
  const loginStudent = serializeMobileLoginStudent(bundle);
  const displayName = loginStudent.displayName || loginStudent.firstName || "Learner";

  const data = serializeTodayJourney({
    dateKey,
    displayName,
    journeys,
    catchUpJourneys,
    assignmentsDueSoon,
    boardId,
  });

  return { ok: true as const, data };
}

export type GenerateTodaysJourneyResult = JourneyResult<
  ReturnType<typeof serializeTodayJourney>
>;
