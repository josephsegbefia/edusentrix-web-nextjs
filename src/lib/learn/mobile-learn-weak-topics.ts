import { Types } from "mongoose";
import { DailyQuestAttempt } from "@/models/DailyQuestAttempt";
import { DailyQuestItem } from "@/models/DailyQuestItem";
import { Homework } from "@/models/Homework";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Submission } from "@/models/Submission";
import type { MobileLearnWeakTopic } from "@/lib/learn/mobile-learn-overview.types";

async function offeringName(schoolId: Types.ObjectId, offeringId?: Types.ObjectId | null) {
  if (!offeringId) return "Subject";
  const row = await SubjectOffering.findOne({ _id: offeringId, schoolId })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();
  return row?.shortName || row?.displayName || "Subject";
}

export async function buildMobileLearnWeakTopics(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  limit?: number;
}): Promise<MobileLearnWeakTopic[]> {
  const limit = input.limit ?? 5;
  const results: MobileLearnWeakTopic[] = [];
  const seen = new Set<string>();

  const pushTopic = (topic: MobileLearnWeakTopic) => {
    const key = `${topic.subjectName}:${topic.title}`;
    if (seen.has(key) || results.length >= limit) return;
    seen.add(key);
    results.push(topic);
  };

  const weakAttempts = await DailyQuestAttempt.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    $or: [{ scorePercent: { $lt: 70 } }, { "weakConcepts.0": { $exists: true } }],
  })
    .sort({ submittedAt: -1 })
    .limit(6)
    .lean<
      Array<{
        _id: Types.ObjectId;
        itemId: Types.ObjectId;
        scorePercent?: number;
        weakConcepts?: string[];
        misconceptionTags?: string[];
      }>
    >();

  for (const attempt of weakAttempts) {
    const item = await DailyQuestItem.findOne({
      _id: attempt.itemId,
      schoolId: input.schoolId,
      studentId: input.studentId,
    })
      .select("title subjectName lessonId subjectId")
      .lean<{
        title: string;
        subjectName: string;
        lessonId?: Types.ObjectId;
        subjectId?: Types.ObjectId;
      } | null>();

    const concept = attempt.weakConcepts?.[0] || item?.title || "Practice topic";
    const score = attempt.scorePercent ?? 0;
    pushTopic({
      id: `weak-attempt-${String(attempt._id)}`,
      subjectName: item?.subjectName || "Revision",
      title: concept,
      confidenceLevel: score < 50 ? "low" : score < 70 ? "medium" : "improving",
      reason:
        score < 70
          ? `Your last practice score was ${Math.round(score)}%. A short rescue review can help.`
          : "Leo noticed a concept that needs a little more practice.",
      recommendedAction: "leo_rescue",
      route: "/(student)/revision",
      leoContext: {
        source: "learn_weak_topic",
        targetType: "weak_topic",
        targetId: String(attempt._id),
        mode: "revise",
      },
    });
  }

  const needsReview = await StudentFlashcardProgress.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    status: "needs_review",
  })
    .sort({ updatedAt: -1 })
    .limit(4)
    .select("deckId")
    .lean<Array<{ deckId: Types.ObjectId }>>();

  for (const row of needsReview) {
    const deck = await LessonFlashcardDeck.findOne({
      _id: row.deckId,
      schoolId: input.schoolId,
    })
      .select("title subjectOfferingId")
      .lean<{ title?: string; subjectOfferingId?: Types.ObjectId } | null>();

    if (!deck) continue;
    const subjectName = await offeringName(input.schoolId, deck.subjectOfferingId);
    pushTopic({
      id: `weak-flash-${String(row.deckId)}`,
      subjectName,
      title: deck.title || "Flashcard review",
      confidenceLevel: "low",
      reason: "Some flashcards need another honest practice round.",
      recommendedAction: "flashcards",
      route: "/(student)/flashcards/[deckId]",
    });
  }

  const recentHomework = await Homework.find({
    schoolId: input.schoolId,
    status: "published",
    classGroupIds: input.classGroupId,
    type: { $in: ["quiz", "assignment", "practice"] },
  })
    .sort({ dueDate: -1 })
    .limit(8)
    .select("_id title subjectId")
    .lean<Array<{ _id: Types.ObjectId; title: string; subjectId: Types.ObjectId }>>();

  for (const hw of recentHomework) {
    const submission = await Submission.findOne({
      schoolId: input.schoolId,
      studentId: input.studentId,
      homeworkId: hw._id,
      status: { $in: ["graded", "submitted", "late"] },
    })
      .select("score questionResponses")
      .lean<{
        score?: number;
        questionResponses?: Array<{ isCorrect?: boolean }>;
      } | null>();

    if (!submission) continue;

    const total = submission.questionResponses?.length ?? 0;
    const missed = submission.questionResponses?.filter((r) => r.isCorrect === false).length ?? 0;
    let scorePercent =
      typeof submission.score === "number" ? Math.round(submission.score) : undefined;
    if (scorePercent === undefined && total > 0) {
      scorePercent = Math.round(((total - missed) / total) * 100);
    }
    if (scorePercent === undefined || scorePercent >= 75) continue;

    const subject = await SubjectOffering.findOne({
      schoolId: input.schoolId,
      subjectId: hw.subjectId,
    })
      .select("displayName shortName")
      .lean<{ displayName?: string; shortName?: string } | null>();

    pushTopic({
      id: `weak-hw-${String(hw._id)}`,
      subjectName: subject?.shortName || subject?.displayName || "Subject",
      title: hw.title,
      confidenceLevel: scorePercent < 55 ? "low" : "medium",
      reason:
        missed > 0
          ? `You missed ${missed} question${missed === 1 ? "" : "s"} on recent school work (${scorePercent}%).`
          : `Your recent score was ${scorePercent}%. A quick review will help.`,
      recommendedAction: "quick_practice",
      route: `/(student)/assignments/${String(hw._id)}`,
      leoContext: {
        source: "learn_assignment",
        targetType: "assignment",
        targetId: String(hw._id),
        mode: "revise",
      },
    });
  }

  return results;
}
