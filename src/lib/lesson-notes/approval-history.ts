import mongoose from "mongoose";
import { LessonNoteApproval, type ApprovalAction } from "@/models/LessonNoteApproval";
import { Teacher } from "@/models/Teacher";
import "@/models/User";

/**
 * Durable approval history for lesson notes. Approval feedback and rejection reasons are kept here,
 * one row per decision, written in the same transaction as the status change.
 */

export type LessonNoteDecisionEntry = {
  action: ApprovalAction;
  comment: string | null;
  actorName: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  at: string;
};

export async function recordLessonNoteDecision(
  session: mongoose.ClientSession,
  entry: {
    lessonNoteId: mongoose.Types.ObjectId;
    schoolId: mongoose.Types.ObjectId;
    action: ApprovalAction;
    actorId: mongoose.Types.ObjectId;
    comment?: string | null;
    previousStatus: string;
    newStatus: string;
  }
): Promise<void> {
  await LessonNoteApproval.create(
    [
      {
        lessonNoteId: entry.lessonNoteId,
        schoolId: entry.schoolId,
        action: entry.action,
        actorId: entry.actorId,
        ...(entry.comment ? { comment: entry.comment } : {}),
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
      },
    ],
    { session }
  );
}

type HistoryRow = {
  action: ApprovalAction;
  comment?: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt: Date;
  actorId?: { firstName?: string; lastName?: string } | null;
};

/** Newest first. Names only; no email addresses or ids. */
export async function loadLessonNoteDecisionHistory(
  lessonNoteId: mongoose.Types.ObjectId,
  schoolId: mongoose.Types.ObjectId,
  limit = 20
): Promise<LessonNoteDecisionEntry[]> {
  const rows = (await LessonNoteApproval.find({ lessonNoteId, schoolId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate("actorId", "firstName lastName")
    .lean()) as unknown as HistoryRow[];

  return rows.map((row) => {
    const actor = row.actorId && typeof row.actorId === "object" ? row.actorId : null;
    const name = actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() : "";
    return {
      action: row.action,
      comment: row.comment || null,
      actorName: name || null,
      previousStatus: row.previousStatus || null,
      newStatus: row.newStatus || null,
      at: new Date(row.createdAt).toISOString(),
    };
  });
}

/** The most recent approval's feedback, if the reviewer left any. */
export function latestApprovalFeedback(history: LessonNoteDecisionEntry[]): string | null {
  const latest = history.find((entry) => entry.action === "approve" || entry.action === "reject");
  return latest?.action === "approve" ? latest.comment : null;
}

/** True when the note belongs to a teacher record owned by this user. */
export async function isOwnLessonNote(
  noteTeacherId: unknown,
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  if (!noteTeacherId) return false;
  const teacher = (await Teacher.findOne({ _id: noteTeacherId, schoolId })
    .select("userId")
    .lean()) as { userId?: unknown } | null;
  return Boolean(teacher?.userId && String(teacher.userId) === String(userId));
}
