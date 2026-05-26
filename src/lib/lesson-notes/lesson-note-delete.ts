import "server-only";

import mongoose, { Types } from "mongoose";
import { Lesson } from "@/models/Lesson";
import { LessonAttendanceLink } from "@/models/LessonAttendanceLink";
import { LessonCoverageRecord } from "@/models/LessonCoverageRecord";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonDeliveryReflection } from "@/models/LessonDeliveryReflection";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { LessonNoteApproval } from "@/models/LessonNoteApproval";
import { LessonNoteReviewComment } from "@/models/LessonNoteReviewComment";
import { LessonResource } from "@/models/LessonResource";
import { LessonSession } from "@/models/LessonSession";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { Homework } from "@/models/Homework";
import type { LessonNoteDeleteImpact, LessonNoteStatus } from "@/types/lesson-notes";
import { normalizeLessonNoteStatus } from "@/types/lesson-notes";

export type { LessonNoteDeleteImpact };

export type LessonNoteDeleteActor =
  | { role: "teacher"; schoolId: Types.ObjectId; teacherId: Types.ObjectId }
  | { role: "admin"; schoolId: Types.ObjectId };

function noteLookupFilter(actor: LessonNoteDeleteActor, noteId: Types.ObjectId) {
  const filter: Record<string, unknown> = {
    _id: noteId,
    schoolId: actor.schoolId,
  };
  if (actor.role === "teacher") {
    filter.teacherId = actor.teacherId;
  }
  return filter;
}

function deleteBlockReason(status: LessonNoteStatus, actor: LessonNoteDeleteActor): string | null {
  if (actor.role === "admin") return null;
  if (status === "approved") {
    return "Approved lesson notes cannot be deleted here. Ask your school admin to remove it from Lesson Notes in admin.";
  }
  return null;
}

function buildWarnings(
  input: {
    status: LessonNoteStatus;
    weekPlanCount: number;
    sessionCount: number;
    completedDeliveryCount: number;
    legacyLessonCount: number;
    linkedHomeworkCount: number;
    reviewCommentCount: number;
  },
  actor: LessonNoteDeleteActor,
): string[] {
  const warnings: string[] = [
    "The lesson note and its content will be permanently removed.",
  ];

  if (actor.role === "admin" && input.status === "approved") {
    warnings.push(
      "This note was approved for delivery. Only school admins can remove it — teachers cannot delete approved notes.",
    );
  }

  if (input.status === "submitted") {
    warnings.push(
      "This note is waiting for admin review. Deleting it withdraws it from the review queue.",
    );
  }

  if (input.status === "approved" && actor.role === "teacher") {
    warnings.push(
      "This note was approved for delivery. Deleting it removes the approved planning record.",
    );
  }

  if (input.status === "rejected") {
    warnings.push("Admin feedback and review history tied to this note will be removed.");
  }

  if (input.weekPlanCount > 0) {
    warnings.push(
      `${input.weekPlanCount} weekly lesson plan${input.weekPlanCount === 1 ? "" : "s"} created from this note will be deleted.`,
    );
  }

  if (input.sessionCount > 0) {
    warnings.push(
      `${input.sessionCount} class session${input.sessionCount === 1 ? "" : "s"}, including teach-mode content and flashcards, will be deleted.`,
    );
  }

  if (input.completedDeliveryCount > 0) {
    warnings.push(
      `${input.completedDeliveryCount} completed delivery record${input.completedDeliveryCount === 1 ? "" : "s"} and coverage data will be removed.`,
    );
  }

  if (input.legacyLessonCount > 0) {
    warnings.push(
      `${input.legacyLessonCount} linked legacy lesson record${input.legacyLessonCount === 1 ? "" : "s"} will be deleted.`,
    );
  }

  if (input.linkedHomeworkCount > 0) {
    warnings.push(
      `${input.linkedHomeworkCount} studio assignment${input.linkedHomeworkCount === 1 ? "" : "s"} will be unlinked from deleted sessions (not deleted).`,
    );
  }

  if (input.reviewCommentCount > 0) {
    warnings.push(
      `${input.reviewCommentCount} admin review comment${input.reviewCommentCount === 1 ? "" : "s"} will be removed.`,
    );
  }

  return warnings;
}

export async function getLessonNoteDeleteImpact(input: {
  noteId: Types.ObjectId;
  actor: LessonNoteDeleteActor;
}): Promise<LessonNoteDeleteImpact | null> {
  const note = await LessonNote.findOne(noteLookupFilter(input.actor, input.noteId))
    .select("topic status weekOf")
    .lean<Pick<ILessonNote, "topic" | "status" | "weekOf">>();

  if (!note) return null;

  const status = normalizeLessonNoteStatus(note.status);
  const blockReason = deleteBlockReason(status, input.actor);

  const sessionIds = await LessonSession.distinct("_id", {
    schoolId: input.actor.schoolId,
    lessonNoteId: input.noteId,
  });

  const sessionCount = sessionIds.length;

  const [
    weekPlanCount,
    completedDeliveryCount,
    legacyLessonCount,
    linkedHomeworkCount,
    reviewCommentCount,
  ] = await Promise.all([
    LessonWeekPlan.countDocuments({
      schoolId: input.actor.schoolId,
      lessonNoteId: input.noteId,
    }),
    sessionCount > 0
      ? LessonDelivery.countDocuments({
          schoolId: input.actor.schoolId,
          sessionId: { $in: sessionIds },
          status: "completed",
        })
      : 0,
    Lesson.countDocuments({
      schoolId: input.actor.schoolId,
      lessonNoteId: input.noteId,
    }),
    sessionCount > 0
      ? Homework.countDocuments({
          schoolId: input.actor.schoolId,
          sourceSessionId: { $in: sessionIds },
        })
      : 0,
    LessonNoteReviewComment.countDocuments({
      schoolId: input.actor.schoolId,
      lessonNoteId: input.noteId,
    }),
  ]);

  const warnings = buildWarnings(
    {
      status,
      weekPlanCount,
      sessionCount,
      completedDeliveryCount,
      legacyLessonCount,
      linkedHomeworkCount,
      reviewCommentCount,
    },
    input.actor,
  );

  return {
    noteId: String(input.noteId),
    topic: note.topic?.trim() || "Untitled lesson note",
    status,
    className: null,
    subjectName: null,
    weekOf: note.weekOf ? new Date(note.weekOf).toISOString() : null,
    canDelete: blockReason === null,
    blockReason,
    weekPlanCount,
    sessionCount,
    completedDeliveryCount,
    legacyLessonCount,
    linkedHomeworkCount,
    reviewCommentCount,
    warnings,
  };
}

export async function deleteLessonNote(input: {
  noteId: Types.ObjectId;
  actor: LessonNoteDeleteActor;
}): Promise<{ deleted: boolean; error?: string; status?: number }> {
  const impact = await getLessonNoteDeleteImpact(input);
  if (!impact) {
    return { deleted: false, error: "Lesson note not found", status: 404 };
  }
  if (!impact.canDelete) {
    return {
      deleted: false,
      error: impact.blockReason ?? "Cannot delete this lesson note",
      status: 403,
    };
  }

  const sessionIds = await LessonSession.distinct("_id", {
    schoolId: input.actor.schoolId,
    lessonNoteId: input.noteId,
  });

  const deliveryIds =
    sessionIds.length > 0
      ? await LessonDelivery.distinct("_id", {
          schoolId: input.actor.schoolId,
          sessionId: { $in: sessionIds },
        })
      : [];

  const legacyLessonIds = await Lesson.distinct("_id", {
    schoolId: input.actor.schoolId,
    lessonNoteId: input.noteId,
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (deliveryIds.length > 0) {
        await LessonDeliveryReflection.deleteMany(
          { schoolId: input.actor.schoolId, deliveryId: { $in: deliveryIds } },
          { session },
        );
        await LessonAttendanceLink.deleteMany(
          { schoolId: input.actor.schoolId, deliveryId: { $in: deliveryIds } },
          { session },
        );
        await LessonDelivery.deleteMany(
          { schoolId: input.actor.schoolId, _id: { $in: deliveryIds } },
          { session },
        );
      }

      if (sessionIds.length > 0) {
        await LessonCoverageRecord.deleteMany(
          {
            schoolId: input.actor.schoolId,
            $or: [{ sessionId: { $in: sessionIds } }, { lessonNoteId: input.noteId }],
          },
          { session },
        );
        await LessonFlashcard.deleteMany(
          { schoolId: input.actor.schoolId, sessionId: { $in: sessionIds } },
          { session },
        );
        await LessonFlashcardDeck.deleteMany(
          { schoolId: input.actor.schoolId, sessionId: { $in: sessionIds } },
          { session },
        );
        await LessonResource.deleteMany(
          { schoolId: input.actor.schoolId, sessionId: { $in: sessionIds } },
          { session },
        );
        await Homework.updateMany(
          { schoolId: input.actor.schoolId, sourceSessionId: { $in: sessionIds } },
          { $unset: { sourceSessionId: 1 } },
          { session },
        );
        await LessonSession.deleteMany(
          { schoolId: input.actor.schoolId, _id: { $in: sessionIds } },
          { session },
        );
      }

      await LessonWeekPlan.deleteMany(
        { schoolId: input.actor.schoolId, lessonNoteId: input.noteId },
        { session },
      );

      if (legacyLessonIds.length > 0) {
        await LessonResource.deleteMany(
          { schoolId: input.actor.schoolId, lessonId: { $in: legacyLessonIds } },
          { session },
        );
        await Lesson.deleteMany(
          { schoolId: input.actor.schoolId, _id: { $in: legacyLessonIds } },
          { session },
        );
      }

      await LessonNoteReviewComment.deleteMany(
        { schoolId: input.actor.schoolId, lessonNoteId: input.noteId },
        { session },
      );
      await LessonNoteApproval.deleteMany(
        { schoolId: input.actor.schoolId, lessonNoteId: input.noteId },
        { session },
      );

      const result = await LessonNote.deleteOne(noteLookupFilter(input.actor, input.noteId), {
        session,
      });

      if (!result.deletedCount) {
        throw new Error("Lesson note not found");
      }
    });
  } finally {
    await session.endSession();
  }

  return { deleted: true };
}

/** @deprecated Use deleteLessonNote with actor */
export async function deleteLessonNoteForTeacher(input: {
  noteId: Types.ObjectId;
  context: { schoolId: Types.ObjectId; teacherId: Types.ObjectId; isAdmin: boolean };
}) {
  return deleteLessonNote({
    noteId: input.noteId,
    actor: { role: "teacher", schoolId: input.context.schoolId, teacherId: input.context.teacherId },
  });
}
