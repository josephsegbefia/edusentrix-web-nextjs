import { Types } from "mongoose";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import type { ILearnSubjectJourney } from "@/models/LearnSubjectJourney";
import { Homework } from "@/models/Homework";
import { Subject } from "@/models/Subject";

import type { MobileJourneyAssignmentSummary } from "./serialize-todays-journey";

function formatDueLabel(dueDate: Date) {
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export async function resolveLinkedAssignmentIds(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  if (journey.linkedAssignmentIds.length > 0) {
    return journey.linkedAssignmentIds;
  }

  const sessionMatches = await Homework.find({
    schoolId: context.schoolId,
    sourceSessionId: journey.lessonSessionId,
    status: "published",
    classGroupIds: context.classGroupId,
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  if (sessionMatches.length > 0) {
    return sessionMatches.map((row) => row._id);
  }

  if (!journey.subjectId) return [];

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);

  const subjectMatches = await Homework.find({
    schoolId: context.schoolId,
    subjectId: journey.subjectId,
    status: "published",
    classGroupIds: context.classGroupId,
    dueDate: { $lte: horizon },
  })
    .sort({ dueDate: 1 })
    .limit(3)
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  return subjectMatches.map((row) => row._id);
}

export async function buildJourneyAssignmentsSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
): Promise<MobileJourneyAssignmentSummary[]> {
  const assignmentIds = await resolveLinkedAssignmentIds(context, journey);
  if (assignmentIds.length === 0) return [];

  const rows = await Homework.find({
    _id: { $in: assignmentIds },
    schoolId: context.schoolId,
  })
    .select("title subjectId dueDate")
    .lean<Array<{ _id: Types.ObjectId; title: string; subjectId: Types.ObjectId; dueDate: Date }>>();

  const subjectIds = [...new Set(rows.map((row) => String(row.subjectId)))].map(
    (id) => new Types.ObjectId(id)
  );
  const subjects = await Subject.find({ _id: { $in: subjectIds }, schoolId: context.schoolId })
    .select("name")
    .lean<Array<{ _id: Types.ObjectId; name?: string }>>();
  const subjectMap = new Map(
    subjects.map((row) => [String(row._id), row.name || journey.subjectName])
  );

  const now = new Date();
  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    subjectName: subjectMap.get(String(row.subjectId)) || journey.subjectName,
    dueLabel: formatDueLabel(row.dueDate),
    dueAt: row.dueDate.toISOString(),
    status: row.dueDate < now ? ("overdue" as const) : ("not_started" as const),
    route: `/(student)/assignments/${String(row._id)}`,
  }));
}
