import "server-only";

import { Types } from "mongoose";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonSession } from "@/models/LessonSession";

export type CoveredLessonSessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  scheduledDate: Date;
  ownerTeacherId?: Types.ObjectId | null;
  durationMinutes?: number;
  contentBlocks?: Array<{ bodyHtml?: string }>;
  status?: string;
  studentVisibility?: string;
  sourceKind?: "lesson_session";
};

export type FindCoveredLessonSessionsInput = {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  /** When set, only completed deliveries within this window are included (published-to-students sessions are not date-filtered). */
  since?: Date;
  limit?: number;
  select?: string;
};

const DEFAULT_SELECT =
  "_id title subjectOfferingId scheduledDate ownerTeacherId durationMinutes contentBlocks status studentVisibility";

function defaultSinceDays(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

/** Session IDs where the teacher marked delivery complete for this class. */
export async function findCompletedDeliverySessionIds(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  since?: Date;
}) {
  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: "completed",
  };

  if (input.since) {
    query.$or = [
      { completedAt: { $gte: input.since } },
      { completedAt: null, updatedAt: { $gte: input.since } },
    ];
  }

  return LessonDelivery.distinct("sessionId", query);
}

/**
 * Sessions the student's class has actually covered:
 * - published to students (studentVisibility + session status), or
 * - delivery completed in class (even if the teacher forgot to toggle student visibility).
 */
export async function findCoveredLessonSessions<T extends CoveredLessonSessionRow = CoveredLessonSessionRow>(
  input: FindCoveredLessonSessionsInput
): Promise<T[]> {
  const completedSessionIds = await findCompletedDeliverySessionIds({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    since: input.since,
  });

  const orClauses: Record<string, unknown>[] = [{ studentVisibility: "published" }];
  if (completedSessionIds.length > 0) {
    orClauses.push({ _id: { $in: completedSessionIds } });
  }

  let query = LessonSession.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: { $ne: "archived" },
    $or: orClauses,
  })
    .sort({ scheduledDate: -1 })
    .select(input.select ?? DEFAULT_SELECT);

  if (input.limit) {
    query = query.limit(input.limit);
  }

  const sessionRows = await query.lean<CoveredLessonSessionRow[]>();
  return sessionRows.map((row) => ({
    ...row,
    sourceKind: "lesson_session" as const,
  })) as T[];
}

export async function findLatestCoveredLessonSession(
  input: Omit<FindCoveredLessonSessionsInput, "limit">
) {
  const rows = await findCoveredLessonSessions({
    ...input,
    limit: 1,
  });
  return rows[0] ?? null;
}

/** Load one session if it is covered for this class (published or delivery completed). */
export async function loadCoveredLessonSessionById<T extends CoveredLessonSessionRow = CoveredLessonSessionRow>(
  input: {
    schoolId: Types.ObjectId;
    classGroupId: Types.ObjectId;
    sessionId: Types.ObjectId;
    select?: string;
  }
): Promise<T | null> {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: { $ne: "archived" },
  })
    .select(input.select ?? DEFAULT_SELECT)
    .lean<T | null>();

  if (!session) return null;

  if (session.studentVisibility === "published") {
    return session;
  }

  const delivery = await LessonDelivery.findOne({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    sessionId: input.sessionId,
    status: "completed",
  })
    .select("_id")
    .lean();

  return delivery ? session : null;
}

export { defaultSinceDays };
