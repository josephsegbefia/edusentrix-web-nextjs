import "server-only";

import mongoose, { Types } from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonDeliveryReflection } from "@/models/LessonDeliveryReflection";
import { LessonAttendanceLink } from "@/models/LessonAttendanceLink";
import { LessonCoverageRecord } from "@/models/LessonCoverageRecord";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonResource } from "@/models/LessonResource";
import { Homework } from "@/models/Homework";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { ExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { DailyQuestItem } from "@/models/DailyQuestItem";
import { DailyQuestBoard } from "@/models/DailyQuestBoard";
import { RevisionBankItem } from "@/models/RevisionBankItem";
import { LearnGuidedAdventure } from "@/models/LearnGuidedAdventure";

export interface SessionDeleteImpact {
  sessionId: string;
  sessionTitle: string;
  canDelete: boolean;
  blockReason: string | null;
  /** Number of flashcard decks (and their cards) that will be removed */
  flashcardDeckCount: number;
  flashcardCount: number;
  /** Linked assignments that will be unlinked (not deleted) */
  linkedAssignmentCount: number;
  /** Resources that will be removed */
  resourceCount: number;
  /** Explore adventures linked to this session in EduSentrix Learn */
  exploreAdventureCount: number;
  /** Daily quest items tied to this session */
  questItemCount: number;
  /** Revision bank items derived from this session */
  revisionItemCount: number;
  /** Delivery was completed — delivery record and coverage data will be removed */
  deliveryCompleted: boolean;
  /** Student progress records that will be removed */
  studentProgressCount: number;
  warnings: string[];
}

function toObjectId(id: string | Types.ObjectId): Types.ObjectId | null {
  try {
    return new Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function getSessionDeleteImpact(input: {
  sessionId: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isAdmin: boolean;
}): Promise<SessionDeleteImpact | null> {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  })
    .select("title ownerTeacherId studentVisibility weekPlanId")
    .lean<{ title: string; ownerTeacherId: Types.ObjectId; studentVisibility: string; weekPlanId?: Types.ObjectId }>();

  if (!session) return null;

  // Only the session owner or a school admin may delete
  const isOwner = String(session.ownerTeacherId) === String(input.teacherId);
  if (!isOwner && !input.isAdmin) {
    return {
      sessionId: String(input.sessionId),
      sessionTitle: session.title || "Untitled session",
      canDelete: false,
      blockReason: "Only the session owner or a school admin can delete this session.",
      flashcardDeckCount: 0,
      flashcardCount: 0,
      linkedAssignmentCount: 0,
      resourceCount: 0,
      exploreAdventureCount: 0,
      questItemCount: 0,
      revisionItemCount: 0,
      deliveryCompleted: false,
      studentProgressCount: 0,
      warnings: [],
    };
  }

  const delivery = await LessonDelivery.findOne({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  })
    .select("status")
    .lean<{ status: string }>();

  const blockReason =
    delivery?.status === "in_progress"
      ? "This session is currently being taught. End the teach session before deleting."
      : null;

  const deckIds = await LessonFlashcardDeck.distinct("_id", {
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const [
    flashcardCount,
    linkedAssignmentCount,
    resourceCount,
    exploreAdventureCount,
    questItemCount,
    revisionItemCount,
    studentProgressCount,
  ] = await Promise.all([
    deckIds.length > 0
      ? LessonFlashcard.countDocuments({
          schoolId: input.schoolId,
          deckId: { $in: deckIds },
        })
      : 0,
    Homework.countDocuments({
      schoolId: input.schoolId,
      sourceSessionId: input.sessionId,
    }),
    LessonResource.countDocuments({
      schoolId: input.schoolId,
      sessionId: input.sessionId,
    }),
    ExploreAdventure.countDocuments({
      schoolId: input.schoolId,
      lessonId: input.sessionId,
    }),
    DailyQuestItem.countDocuments({
      schoolId: input.schoolId,
      lessonId: input.sessionId,
    }),
    RevisionBankItem.countDocuments({
      schoolId: input.schoolId,
      lessonId: input.sessionId,
    }),
    StudentSessionProgress.countDocuments({
      schoolId: input.schoolId,
      sessionId: input.sessionId,
    }),
  ]);

  const deliveryCompleted = delivery?.status === "completed";

  const warnings: string[] = ["This session and its content will be permanently removed."];

  if (deliveryCompleted) {
    warnings.push(
      "This session has been delivered. Completed delivery records and coverage data will be removed.",
    );
  }

  if (deckIds.length > 0) {
    warnings.push(
      `${deckIds.length} flashcard deck${deckIds.length === 1 ? "" : "s"} with ${flashcardCount} card${flashcardCount === 1 ? "" : "s"} will be deleted. Student study progress for those cards will also be removed.`,
    );
  }

  if (resourceCount > 0) {
    warnings.push(
      `${resourceCount} attached resource${resourceCount === 1 ? "" : "s"} will be deleted.`,
    );
  }

  if (linkedAssignmentCount > 0) {
    warnings.push(
      `${linkedAssignmentCount} studio assignment${linkedAssignmentCount === 1 ? "" : "s"} will be unlinked from this session but not deleted.`,
    );
  }

  if (exploreAdventureCount > 0) {
    warnings.push(
      `${exploreAdventureCount} EduSentrix Learn explore adventure${exploreAdventureCount === 1 ? "" : "s"} tied to this session will be deleted from the student app.`,
    );
  }

  if (questItemCount > 0) {
    warnings.push(
      `${questItemCount} daily quest item${questItemCount === 1 ? "" : "s"} linked to this session will be removed from EduSentrix Learn.`,
    );
  }

  if (revisionItemCount > 0) {
    warnings.push(
      `${revisionItemCount} revision topic${revisionItemCount === 1 ? "" : "s"} derived from this session will be removed from EduSentrix Learn.`,
    );
  }

  if (studentProgressCount > 0) {
    warnings.push(
      `${studentProgressCount} student${studentProgressCount === 1 ? "" : "s"} have viewed or completed this session — their progress records will be removed.`,
    );
  }

  return {
    sessionId: String(input.sessionId),
    sessionTitle: session.title || "Untitled session",
    canDelete: blockReason === null,
    blockReason,
    flashcardDeckCount: deckIds.length,
    flashcardCount,
    linkedAssignmentCount,
    resourceCount,
    exploreAdventureCount,
    questItemCount,
    revisionItemCount,
    deliveryCompleted,
    studentProgressCount,
    warnings,
  };
}

export async function deleteLessonSession(input: {
  sessionId: Types.ObjectId | string;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isAdmin: boolean;
}): Promise<{ deleted: boolean; error?: string; status?: number }> {
  const sessionOid = toObjectId(input.sessionId);
  if (!sessionOid) return { deleted: false, error: "Invalid session ID", status: 400 };

  const impact = await getSessionDeleteImpact({
    sessionId: sessionOid,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
  });

  if (!impact) return { deleted: false, error: "Session not found", status: 404 };
  if (!impact.canDelete) {
    return {
      deleted: false,
      error: impact.blockReason ?? "Cannot delete this session",
      status: 403,
    };
  }

  // Gather IDs needed for cascade
  const delivery = await LessonDelivery.findOne({
    schoolId: input.schoolId,
    sessionId: sessionOid,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  const deliveryId = delivery?._id ?? null;

  const deckIds = await LessonFlashcardDeck.distinct("_id", {
    schoolId: input.schoolId,
    sessionId: sessionOid,
  });

  const exploreAdventureIds = await ExploreAdventure.distinct("_id", {
    schoolId: input.schoolId,
    lessonId: sessionOid,
  });

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      // 1. Delivery chain
      if (deliveryId) {
        await LessonDeliveryReflection.deleteMany(
          { schoolId: input.schoolId, deliveryId },
          { session: dbSession },
        );
        await LessonAttendanceLink.deleteMany(
          { schoolId: input.schoolId, deliveryId },
          { session: dbSession },
        );
        await LessonDelivery.deleteOne(
          { schoolId: input.schoolId, _id: deliveryId },
          { session: dbSession },
        );
      }

      // 2. Coverage records
      await LessonCoverageRecord.deleteMany(
        { schoolId: input.schoolId, sessionId: sessionOid },
        { session: dbSession },
      );

      // 3. Flashcards + student progress for those cards
      if (deckIds.length > 0) {
        await StudentFlashcardProgress.deleteMany(
          { schoolId: input.schoolId, deckId: { $in: deckIds } },
          { session: dbSession },
        );
        await LessonFlashcard.deleteMany(
          { schoolId: input.schoolId, deckId: { $in: deckIds } },
          { session: dbSession },
        );
        await LessonFlashcardDeck.deleteMany(
          { schoolId: input.schoolId, sessionId: sessionOid },
          { session: dbSession },
        );
      }

      // 4. Resources
      await LessonResource.deleteMany(
        { schoolId: input.schoolId, sessionId: sessionOid },
        { session: dbSession },
      );

      // 5. Student session progress
      await StudentSessionProgress.deleteMany(
        { schoolId: input.schoolId, sessionId: sessionOid },
        { session: dbSession },
      );

      // 6. Unlink assignments (do not delete)
      await Homework.updateMany(
        { schoolId: input.schoolId, sourceSessionId: sessionOid },
        { $unset: { sourceSessionId: 1 } },
        { session: dbSession },
      );

      // 7. EduSentrix Learn — explore
      if (exploreAdventureIds.length > 0) {
        await ExploreAdventure.deleteMany(
          { schoolId: input.schoolId, lessonId: sessionOid },
          { session: dbSession },
        );
      }
      await ExploreGenerationJob.deleteMany(
        { schoolId: input.schoolId, lessonId: sessionOid },
        { session: dbSession },
      );

      // 8. EduSentrix Learn — quests
      await DailyQuestItem.deleteMany(
        { schoolId: input.schoolId, lessonId: sessionOid },
        { session: dbSession },
      );
      await DailyQuestBoard.updateMany(
        { schoolId: input.schoolId, generatedFromLessonIds: sessionOid },
        { $pull: { generatedFromLessonIds: sessionOid } },
        { session: dbSession },
      );

      // 9. EduSentrix Learn — revision
      await RevisionBankItem.deleteMany(
        { schoolId: input.schoolId, lessonId: sessionOid },
        { session: dbSession },
      );

      // 10. EduSentrix Learn — guided adventures
      await LearnGuidedAdventure.deleteMany(
        { schoolId: input.schoolId, "metadata.sessionId": String(sessionOid) },
        { session: dbSession },
      );

      // 11. Pull session from its week plan
      await LessonWeekPlan.updateOne(
        { schoolId: input.schoolId, sessionIds: sessionOid },
        { $pull: { sessionIds: sessionOid } },
        { session: dbSession },
      );

      // 12. Delete the session itself
      const result = await LessonSession.deleteOne(
        { schoolId: input.schoolId, _id: sessionOid },
        { session: dbSession },
      );

      if (!result.deletedCount) {
        throw new Error("Session not found during delete");
      }
    });
  } finally {
    await dbSession.endSession();
  }

  return { deleted: true };
}
