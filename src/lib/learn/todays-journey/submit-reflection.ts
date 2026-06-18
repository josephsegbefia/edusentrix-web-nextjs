import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { LearnSubjectJourney } from "@/models/LearnSubjectJourney";
import { RevisionBankItem } from "@/models/RevisionBankItem";

import { dateKeyForSchoolDay, JOURNEY_TIMEZONE } from "./journey-step-utils";
import { loadSubjectJourneyDetail } from "./load-subject-journey";
import { updateJourneyStep } from "./update-journey-step";

type ReflectionConfidence = "not_yet" | "a_little" | "good" | "very_well";

type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

function masteryConfidence(confidence: ReflectionConfidence) {
  if (confidence === "very_well") return "high" as const;
  if (confidence === "good") return "medium" as const;
  if (confidence === "a_little") return "low" as const;
  return "low" as const;
}

function scheduleReviewDate(confidence: ReflectionConfidence) {
  const date = new Date();
  if (confidence === "very_well") {
    date.setDate(date.getDate() + 7);
  } else if (confidence === "good") {
    date.setDate(date.getDate() + 3);
  } else {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export async function submitJourneyReflection(
  context: LearnMobileStudentContext,
  journeyId: string,
  input: { confidence: ReflectionConfidence; studentNote?: string }
): Promise<JourneyResult<Awaited<ReturnType<typeof loadSubjectJourneyDetail>>["data"]>> {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(journeyId)) {
    return {
      ok: false,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  const journey = await LearnSubjectJourney.findOne({
    _id: journeyId,
    schoolId: context.schoolId,
    studentId: context.studentId,
  });

  if (!journey) {
    return {
      ok: false,
      code: "JOURNEY_NOT_FOUND",
      message: "Subject journey not found.",
      status: 404,
    };
  }

  const reflectionStep = journey.steps.find((step) => step.key === "reflection");
  if (reflectionStep?.status === "locked") {
    return {
      ok: false,
      code: "STEP_LOCKED",
      message: "Reflection is not available yet.",
      status: 400,
    };
  }

  if (reflectionStep?.status === "completed") {
    return loadSubjectJourneyDetail(context, journeyId);
  }

  const confidence = input.confidence;
  const nextReviewAt = scheduleReviewDate(confidence);
  const signal = masteryConfidence(confidence);

  journey.reflection = {
    confidence,
    studentNote: input.studentNote?.trim() || null,
    submittedAt: new Date(),
  };
  journey.masterySignal = {
    ...journey.masterySignal,
    confidence: signal,
    nextReviewAt,
    weakConcepts:
      confidence === "not_yet" || confidence === "a_little"
        ? [journey.topicTitle]
        : journey.masterySignal.weakConcepts,
  };
  await journey.save();

  if ((confidence === "not_yet" || confidence === "a_little") && context.classGroupId) {
    const existing = await RevisionBankItem.findOne({
      schoolId: context.schoolId,
      studentId: context.studentId,
      lessonId: journey.lessonSessionId,
      status: "active",
    });

    if (existing) {
      existing.priorityScore = Math.max(existing.priorityScore, 55);
      existing.conceptTitle = journey.topicTitle;
      await existing.save();
    } else {
      await RevisionBankItem.create({
        schoolId: context.schoolId,
        studentId: context.studentId,
        classGroupId: context.classGroupId,
        subjectOfferingId: journey.subjectOfferingId ?? null,
        subjectId: journey.subjectId ?? null,
        subjectName: journey.subjectName,
        lessonId: journey.lessonSessionId,
        conceptTitle: journey.topicTitle,
        conceptTags: [journey.topicTitle],
        sourceBoardId: journey.boardId ?? null,
        reason: "weak_topic",
        priorityScore: confidence === "not_yet" ? 65 : 55,
        dueDate: dateKeyForSchoolDay(nextReviewAt, JOURNEY_TIMEZONE),
        status: "active",
      });
    }
  }

  const updated = await updateJourneyStep({
    context,
    journeyId,
    stepKey: "reflection",
    status: "completed",
    progressPercent: 100,
    metadata: { confidence, studentNote: input.studentNote?.trim() || null },
  });

  if (updated.ok) {
    await recordLearnMobileActivity({
      schoolId: context.schoolId,
      studentId: context.studentId,
      accountId: context.accountId,
      gradeId: context.gradeId,
      classGroupId: context.classGroupId,
      eventType: "revision_session",
      topic: journey.topicTitle,
      metadata: {
        journeyId,
        confidence,
        masterySignal: signal,
      },
    });
  }

  return updated;
}
