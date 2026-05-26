import "server-only";

import { Types } from "mongoose";
import {
  defaultSinceDays,
  findCoveredLessonSessions,
  type CoveredLessonSessionRow,
} from "@/lib/learn/covered-lesson-sessions";
import { DailyQuestAttempt, type IDailyQuestAttempt } from "@/models/DailyQuestAttempt";
import {
  DailyQuestItem,
  type DailyQuestPriorityReason,
  type DailyQuestItemType,
  type IDailyQuestItem,
} from "@/models/DailyQuestItem";
import { RevisionBankItem, type IRevisionBankItem } from "@/models/RevisionBankItem";
import { SubjectOffering } from "@/models/SubjectOffering";
import {
  DAILY_QUEST_SCORE,
  type BuildDailyQuestCandidatesInput,
  type DailyQuestCandidate,
  type DailyQuestCandidateBuildResult,
} from "./daily-quest-types";

type CandidateSessionRow = CoveredLessonSessionRow & {
  durationMinutes?: number;
  contentBlocks?: Array<{ bodyHtml?: string }>;
};

type SubjectOfferingRow = {
  _id: Types.ObjectId;
  subjectId?: Types.ObjectId | null;
  displayName?: string;
  shortName?: string;
};

type UnfinishedQuestItemRow = Pick<
  IDailyQuestItem,
  | "_id"
  | "boardId"
  | "schoolId"
  | "studentId"
  | "classGroupId"
  | "gradeId"
  | "lessonId"
  | "subjectOfferingId"
  | "subjectId"
  | "subjectName"
  | "type"
  | "title"
  | "description"
  | "required"
  | "weight"
  | "estimatedMinutes"
  | "xpReward"
  | "priorityScore"
  | "priorityLabel"
  | "source"
  | "lastActivityAt"
  | "updatedAt"
>;

type RevisionBankItemRow = Pick<
  IRevisionBankItem,
  | "_id"
  | "schoolId"
  | "studentId"
  | "classGroupId"
  | "subjectOfferingId"
  | "subjectId"
  | "subjectName"
  | "lessonId"
  | "conceptTitle"
  | "conceptTags"
  | "sourceBoardId"
  | "sourceItemId"
  | "reason"
  | "priorityScore"
>;

type WeakAttemptRow = Pick<
  IDailyQuestAttempt,
  | "_id"
  | "boardId"
  | "itemId"
  | "schoolId"
  | "studentId"
  | "scorePercent"
  | "weakConcepts"
  | "misconceptionTags"
  | "submittedAt"
>;

function startOfSchoolDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function differenceInSchoolDays(left: Date, right: Date) {
  const leftStart = startOfSchoolDay(left).getTime();
  const rightStart = startOfSchoolDay(right).getTime();
  return Math.max(0, Math.floor((leftStart - rightStart) / 86_400_000));
}

function isSameSchoolDay(left: Date, right: Date) {
  return differenceInSchoolDays(left, right) === 0;
}

function stripHtml(value?: string | null) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lessonHasStudentContent(session: CandidateSessionRow) {
  if (!session.contentBlocks?.length) return false;
  return session.contentBlocks.some((block) => stripHtml(block.bodyHtml).length >= 40);
}

function formatCoveredDate(date: Date, boardDate: Date) {
  if (isSameSchoolDay(date, boardDate)) return "today";
  const days = differenceInSchoolDays(boardDate, date);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function objectIdKey(value?: Types.ObjectId | null) {
  return value?.toString() ?? "";
}

async function loadSubjectOfferingMap(input: {
  schoolId: Types.ObjectId;
  subjectOfferingIds: Types.ObjectId[];
}) {
  const ids = Array.from(new Set(input.subjectOfferingIds.map((id) => id.toString()))).map(
    (id) => new Types.ObjectId(id)
  );

  if (ids.length === 0) {
    return new Map<string, SubjectOfferingRow>();
  }

  const rows = await SubjectOffering.find({
    _id: { $in: ids },
    schoolId: input.schoolId,
  })
    .select("_id subjectId displayName shortName")
    .lean<SubjectOfferingRow[]>();

  return new Map(rows.map((row) => [row._id.toString(), row]));
}

function subjectNameForOffering(
  subjectOfferingId: Types.ObjectId | null | undefined,
  subjectOfferings: Map<string, SubjectOfferingRow>
) {
  if (!subjectOfferingId) return "Learning";
  const subject = subjectOfferings.get(subjectOfferingId.toString());
  return subject?.shortName || subject?.displayName || "Learning";
}

function subjectIdForOffering(
  subjectOfferingId: Types.ObjectId | null | undefined,
  subjectOfferings: Map<string, SubjectOfferingRow>
) {
  if (!subjectOfferingId) return null;
  return subjectOfferings.get(subjectOfferingId.toString())?.subjectId ?? null;
}

function scoreCoveredLesson(session: CandidateSessionRow, boardDate: Date) {
  const coveredAt = session.scheduledDate;
  const isToday = isSameSchoolDay(coveredAt, boardDate);
  const agePenalty =
    differenceInSchoolDays(boardDate, coveredAt) * DAILY_QUEST_SCORE.oldQuestPenaltyPerSchoolDay;
  const contentBonus = lessonHasStudentContent(session) ? 10 : 0;
  return Math.max(
    5,
    (isToday ? DAILY_QUEST_SCORE.taughtToday : DAILY_QUEST_SCORE.notReviewed) +
      contentBonus +
      agePenalty
  );
}

function coveredLessonCandidate(
  input: BuildDailyQuestCandidatesInput,
  session: CandidateSessionRow,
  subjectOfferings: Map<string, SubjectOfferingRow>,
  boardDate: Date
): DailyQuestCandidate {
  const taughtToday = isSameSchoolDay(session.scheduledDate, boardDate);
  const subjectName = subjectNameForOffering(session.subjectOfferingId, subjectOfferings);
  const priorityReason: DailyQuestPriorityReason = taughtToday ? "taught_today" : "not_reviewed";
  const itemType: DailyQuestItemType = taughtToday ? "lesson_review" : "quick_check";
  const coveredLabel = formatCoveredDate(session.scheduledDate, boardDate);

  return {
    id: `covered:${session._id.toString()}`,
    source: "covered_lesson",
    itemType,
    priorityReason,
    priorityScore: scoreCoveredLesson(session, boardDate),
    priorityLabel: taughtToday ? "Covered today" : `Covered ${coveredLabel}`,
    required: taughtToday,
    weight: taughtToday ? 2 : 1,
    estimatedMinutes: Math.min(10, Math.max(4, Math.round((session.durationMinutes ?? 35) / 8))),
    xpReward: taughtToday ? 24 : 14,
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    gradeId: input.gradeId ?? null,
    lessonId: session._id,
    subjectOfferingId: session.subjectOfferingId,
    subjectId: subjectIdForOffering(session.subjectOfferingId, subjectOfferings),
    subjectName,
    title: taughtToday ? `Review ${session.title}` : `Quick check: ${session.title}`,
    description: taughtToday
      ? `Refresh what your class covered in ${subjectName} today.`
      : `Keep ${session.title} fresh with a short check-in.`,
    coveredAt: session.scheduledDate,
    teacherId: session.ownerTeacherId,
    conceptTags: [session.title],
  };
}

function unfinishedItemCandidate(row: UnfinishedQuestItemRow): DailyQuestCandidate {
  return {
    id: `unfinished:${row._id.toString()}`,
    source: "unfinished_item",
    itemType: row.type,
    priorityReason: "started_but_incomplete",
    priorityScore:
      Math.max(row.priorityScore, DAILY_QUEST_SCORE.startedButIncomplete) +
      (row.required ? 8 : 0),
    priorityLabel: "Started but incomplete",
    required: row.required,
    weight: row.weight,
    estimatedMinutes: row.estimatedMinutes,
    xpReward: row.xpReward,
    schoolId: row.schoolId,
    studentId: row.studentId,
    classGroupId: row.classGroupId,
    gradeId: row.gradeId ?? null,
    lessonId: row.lessonId ?? null,
    subjectOfferingId: row.subjectOfferingId ?? null,
    subjectId: row.subjectId ?? null,
    subjectName: row.subjectName,
    title: `Finish: ${row.title}`,
    description: row.description,
    sourceBoardId: row.boardId,
    sourceItemId: row._id,
    coveredAt: row.source.coveredAt ?? null,
    teacherId: row.source.teacherId ?? null,
  };
}

function revisionItemType(row: RevisionBankItemRow): DailyQuestItemType {
  if (row.reason === "spaced_repetition") return "spaced_repetition";
  if (row.reason === "weak_topic") return "weak_spot_rescue";
  return "catch_up_review";
}

function revisionPriorityReason(row: RevisionBankItemRow) {
  if (row.reason === "spaced_repetition") return "spaced_repetition";
  if (row.reason === "teacher_priority") return "teacher_priority";
  if (row.reason === "weak_topic") return "weak_topic";
  return "not_reviewed";
}

function revisionBankCandidate(row: RevisionBankItemRow): DailyQuestCandidate {
  const isWeakTopic = row.reason === "weak_topic";
  return {
    id: `revision:${row._id.toString()}`,
    source: "revision_bank",
    itemType: revisionItemType(row),
    priorityReason: revisionPriorityReason(row),
    priorityScore:
      row.priorityScore +
      (isWeakTopic ? DAILY_QUEST_SCORE.weakTopic : DAILY_QUEST_SCORE.spacedRepetitionDue),
    priorityLabel: isWeakTopic ? "Weak spot" : "Revision due",
    required: isWeakTopic,
    weight: isWeakTopic ? 2 : 1,
    estimatedMinutes: isWeakTopic ? 7 : 5,
    xpReward: isWeakTopic ? 24 : 16,
    schoolId: row.schoolId,
    studentId: row.studentId,
    classGroupId: row.classGroupId,
    lessonId: row.lessonId ?? null,
    subjectOfferingId: row.subjectOfferingId ?? null,
    subjectId: row.subjectId ?? null,
    subjectName: row.subjectName,
    title: isWeakTopic ? `Leo rescue: ${row.conceptTitle}` : `Revise: ${row.conceptTitle}`,
    description: isWeakTopic
      ? `Work through ${row.conceptTitle} with a short rescue practice.`
      : `Bring ${row.conceptTitle} back before it gets rusty.`,
    sourceBoardId: row.sourceBoardId ?? null,
    sourceItemId: row.sourceItemId ?? null,
    conceptTags: row.conceptTags,
    revisionReason: row.reason,
  };
}

function weakAttemptCandidate(
  input: BuildDailyQuestCandidatesInput,
  row: WeakAttemptRow
): DailyQuestCandidate {
  const conceptTitle = row.weakConcepts[0] || row.misconceptionTags[0] || "a tricky idea";
  return {
    id: `weak-attempt:${row._id.toString()}`,
    source: "weak_attempt",
    itemType: "weak_spot_rescue",
    priorityReason: "weak_topic",
    priorityScore: DAILY_QUEST_SCORE.weakTopic + Math.max(0, 70 - row.scorePercent),
    priorityLabel: "Needs a rescue round",
    required: true,
    weight: 2,
    estimatedMinutes: 7,
    xpReward: 24,
    schoolId: row.schoolId,
    studentId: row.studentId,
    classGroupId: input.classGroupId,
    gradeId: input.gradeId ?? null,
    subjectName: "Review",
    title: `Fix ${conceptTitle}`,
    description: `Your last try showed ${conceptTitle} needs a calmer second look.`,
    sourceBoardId: row.boardId,
    sourceItemId: row.itemId,
    conceptTags: [...row.weakConcepts, ...row.misconceptionTags].filter(Boolean),
  };
}

function dedupeCandidates(candidates: DailyQuestCandidate[]) {
  const bestByKey = new Map<string, DailyQuestCandidate>();

  for (const candidate of candidates) {
    const lessonKey = objectIdKey(candidate.lessonId);
    const sourceItemKey = objectIdKey(candidate.sourceItemId);
    const conceptKey = candidate.conceptTags?.[0]?.toLowerCase() ?? "";
    const key =
      lessonKey || sourceItemKey
        ? `${candidate.itemType}:${lessonKey || sourceItemKey}`
        : `${candidate.itemType}:${candidate.subjectName}:${conceptKey}:${candidate.title}`;
    const existing = bestByKey.get(key);

    if (!existing || candidate.priorityScore > existing.priorityScore) {
      bestByKey.set(key, candidate);
    }
  }

  return Array.from(bestByKey.values()).sort((left, right) => right.priorityScore - left.priorityScore);
}

async function buildTeacherPriorityCandidates(): Promise<DailyQuestCandidate[]> {
  // Placeholder for later teacher-pinned lesson/task support.
  return [];
}

export async function buildDailyQuestCandidates(
  input: BuildDailyQuestCandidatesInput
): Promise<DailyQuestCandidateBuildResult> {
  const boardDate = input.date ?? new Date();
  const since = defaultSinceDays(7);

  const coveredLessons = await findCoveredLessonSessions<CandidateSessionRow>({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    since,
    limit: 16,
    select:
      "_id title subjectOfferingId scheduledDate ownerTeacherId durationMinutes contentBlocks status studentVisibility",
  });

  const unfinishedItems = await DailyQuestItem.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    status: { $in: ["available", "not_started", "in_progress", "carried_forward"] },
    lifecycle: { $in: ["today_active", "catch_up"] },
  })
    .sort({ lastActivityAt: -1, updatedAt: -1 })
    .limit(12)
    .select(
      "_id boardId schoolId studentId classGroupId gradeId lessonId subjectOfferingId subjectId subjectName type title description required weight estimatedMinutes xpReward priorityScore priorityLabel source lastActivityAt updatedAt"
    )
    .lean<UnfinishedQuestItemRow[]>();

  const revisionBankItems = await RevisionBankItem.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    status: "active",
  })
    .sort({ priorityScore: -1, updatedAt: -1 })
    .limit(12)
    .select(
      "_id schoolId studentId classGroupId subjectOfferingId subjectId subjectName lessonId conceptTitle conceptTags sourceBoardId sourceItemId reason priorityScore"
    )
    .lean<RevisionBankItemRow[]>();

  const weakAttempts = await DailyQuestAttempt.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    $or: [{ scorePercent: { $lt: 70 } }, { "weakConcepts.0": { $exists: true } }],
  })
    .sort({ submittedAt: -1 })
    .limit(8)
    .select("_id boardId itemId schoolId studentId scorePercent weakConcepts misconceptionTags submittedAt")
    .lean<WeakAttemptRow[]>();

  const subjectOfferingIds = [
    ...coveredLessons.map((session) => session.subjectOfferingId),
    ...unfinishedItems.map((item) => item.subjectOfferingId).filter(Boolean),
    ...revisionBankItems.map((item) => item.subjectOfferingId).filter(Boolean),
  ] as Types.ObjectId[];
  const subjectOfferings = await loadSubjectOfferingMap({
    schoolId: input.schoolId,
    subjectOfferingIds,
  });

  const teacherPriorityCandidates = await buildTeacherPriorityCandidates();
  const candidates = dedupeCandidates([
    ...coveredLessons.map((session) =>
      coveredLessonCandidate(input, session, subjectOfferings, boardDate)
    ),
    ...unfinishedItems.map(unfinishedItemCandidate),
    ...revisionBankItems.map(revisionBankCandidate),
    ...weakAttempts.map((attempt) => weakAttemptCandidate(input, attempt)),
    ...teacherPriorityCandidates,
  ]);

  return {
    candidates,
    meta: {
      coveredLessonCount: coveredLessons.length,
      unfinishedItemCount: unfinishedItems.length,
      revisionBankCount: revisionBankItems.length,
      weakAttemptCount: weakAttempts.length,
      teacherPriorityCount: teacherPriorityCandidates.length,
    },
  };
}
