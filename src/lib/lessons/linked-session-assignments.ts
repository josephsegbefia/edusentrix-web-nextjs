import "server-only";

import type { Types } from "mongoose";
import { Homework } from "@/models/Homework";

export type SessionLinkedAssignmentsSummary = {
  total: number;
  published: number;
  draft: number;
  quizCount: number;
  assignmentCount: number;
};

export type SessionLinkedAssignmentItem = {
  id: string;
  title: string;
  type: "assignment" | "quiz" | "project" | "practice";
  status: "draft" | "published" | "closed" | "archived";
  dueDate: string;
  maxScore: number;
  submissionCount: number;
  createdAt: string | null;
};

export async function linkedAssignmentsSummaryForSession(
  schoolId: Types.ObjectId,
  sessionId: Types.ObjectId,
): Promise<SessionLinkedAssignmentsSummary | null> {
  const rows = await Homework.aggregate<{
    _id: { status?: string; type?: string };
    n: number;
  }>([
    { $match: { schoolId, sourceSessionId: sessionId } },
    { $group: { _id: { status: "$status", type: "$type" }, n: { $sum: 1 } } },
  ]);
  if (rows.length === 0) return null;

  let total = 0;
  let published = 0;
  let draft = 0;
  let quizCount = 0;
  let assignmentCount = 0;
  for (const r of rows) {
    total += r.n;
    if (r._id.status === "published") published += r.n;
    if (r._id.status === "draft") draft += r.n;
    if (r._id.type === "quiz") quizCount += r.n;
    if (
      r._id.type === "assignment" ||
      r._id.type === "project" ||
      r._id.type === "practice"
    ) {
      assignmentCount += r.n;
    }
  }
  return { total, published, draft, quizCount, assignmentCount };
}

export async function listLinkedAssignmentsForSession(
  schoolId: Types.ObjectId,
  sessionId: Types.ObjectId,
): Promise<SessionLinkedAssignmentItem[]> {
  const rows = await Homework.find({ schoolId, sourceSessionId: sessionId })
    .sort({ createdAt: -1 })
    .limit(40)
    .select("title type status dueDate maxScore submissionCount createdAt")
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    type: row.type,
    status: row.status,
    dueDate: new Date(row.dueDate).toISOString(),
    maxScore: row.maxScore,
    submissionCount: row.submissionCount ?? 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }));
}
