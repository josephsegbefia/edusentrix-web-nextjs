import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  LearnSubjectJourney,
  type ILearnJourneyStepProgress,
  type ILearnSubjectJourney,
  type LearnJourneyStepKey,
} from "@/models/LearnSubjectJourney";

import {
  computeJourneyCompletion,
  deriveJourneyStatus,
  isValidJourneyStepKey,
  syncStepLocks,
} from "./journey-step-utils";
import { loadSubjectJourneyDetail, loadScopedSubjectJourney } from "./load-subject-journey";

type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

export type UpdateJourneyStepInput = {
  context: LearnMobileStudentContext;
  journeyId: string;
  stepKey: string;
  status?: "in_progress" | "completed" | "skipped";
  progressPercent?: number;
  elapsedSeconds?: number;
  metadata?: Record<string, unknown>;
};

function firstAvailableStep(steps: ILearnJourneyStepProgress[]) {
  return steps.find(
    (step) =>
      step.status === "available" ||
      step.status === "not_started" ||
      step.status === "in_progress"
  );
}

async function persistJourneySteps(journey: ILearnSubjectJourney, steps: ILearnJourneyStepProgress[]) {
  const synced = syncStepLocks(steps);
  const metrics = computeJourneyCompletion(synced);
  const status = deriveJourneyStatus({
    status: journey.status,
    completionPercent: metrics.completionPercent,
    steps: synced,
  });

  await LearnSubjectJourney.updateOne(
    { _id: journey._id },
    {
      $set: {
        steps: synced,
        completionPercent: metrics.completionPercent,
        xpEarned: metrics.xpEarned,
        totalXpAvailable: metrics.totalXpAvailable,
        status,
      },
    }
  );

  return { steps: synced, metrics, status };
}

export async function startSubjectJourney(
  context: LearnMobileStudentContext,
  journeyId: string
): Promise<JourneyResult<Awaited<ReturnType<typeof loadSubjectJourneyDetail>>["data"]>> {
  await connectToDatabase();

  const loaded = await loadScopedSubjectJourney(context, journeyId);
  if (!loaded.ok) return loaded;

  const journey = loaded.journey;
  const now = new Date();
  let changed = false;

  const steps = journey.steps.map((step) => {
    if (step.status === "completed" || step.status === "skipped") return step;

    const first = firstAvailableStep(journey.steps);
    if (first && step.key === first.key && step.status !== "in_progress") {
      changed = true;
      return {
        ...step,
        status: "in_progress" as const,
        startedAt: step.startedAt ?? now,
        lastActivityAt: now,
        progressPercent: Math.max(step.progressPercent, 5),
      };
    }

    if (step.status === "locked") return step;
    if (step.status === "available") return step;
    return step;
  });

  if (changed || journey.status === "available" || journey.status === "not_started") {
    await persistJourneySteps(journey, steps);
  }

  const detail = await loadSubjectJourneyDetail(context, journeyId);
  return detail.ok ? detail : detail;
}

export async function updateJourneyStep(
  input: UpdateJourneyStepInput
): Promise<JourneyResult<Awaited<ReturnType<typeof loadSubjectJourneyDetail>>["data"]>> {
  await connectToDatabase();

  if (!isValidJourneyStepKey(input.stepKey)) {
    return {
      ok: false,
      code: "INVALID_STEP_KEY",
      message: "Invalid journey step key.",
      status: 400,
    };
  }

  const loaded = await loadScopedSubjectJourney(input.context, input.journeyId);
  if (!loaded.ok) return loaded;

  const journey = loaded.journey;
  const stepKey = input.stepKey as LearnJourneyStepKey;
  const target = journey.steps.find((step) => step.key === stepKey);

  if (!target) {
    return {
      ok: false,
      code: "STEP_NOT_FOUND",
      message: "Journey step not found.",
      status: 404,
    };
  }

  if (target.status === "locked") {
    return {
      ok: false,
      code: "STEP_LOCKED",
      message: "This step is not available yet.",
      status: 400,
    };
  }

  if (target.status === "completed" && input.status && input.status !== "completed") {
    return {
      ok: false,
      code: "STEP_ALREADY_COMPLETED",
      message: "Completed steps cannot be changed.",
      status: 400,
    };
  }

  const now = new Date();
  const nextStatus = input.status ?? target.status;
  const nextProgress =
    typeof input.progressPercent === "number"
      ? Math.min(100, Math.max(0, input.progressPercent))
      : nextStatus === "completed"
        ? 100
        : target.progressPercent;

  const steps = journey.steps.map((step) => {
    if (step.key !== stepKey) return step;

    return {
      ...step,
      status: nextStatus,
      progressPercent: nextProgress,
      startedAt: step.startedAt ?? (nextStatus === "in_progress" ? now : step.startedAt),
      completedAt:
        nextStatus === "completed" || nextStatus === "skipped"
          ? step.completedAt ?? now
          : step.completedAt,
      lastActivityAt: now,
    };
  });

  const { metrics } = await persistJourneySteps(journey, steps);

  if (nextStatus === "completed") {
    await recordLearnMobileActivity({
      schoolId: input.context.schoolId,
      studentId: input.context.studentId,
      accountId: input.context.accountId,
      gradeId: input.context.gradeId,
      classGroupId: input.context.classGroupId,
      eventType: "quest_completed",
      topic: journey.topicTitle,
      durationSeconds: input.elapsedSeconds,
      metadata: {
        journeyId: String(journey._id),
        stepKey,
        subjectName: journey.subjectName,
        completionPercent: metrics.completionPercent,
        ...(input.metadata ?? {}),
      },
    });
  }

  const detail = await loadSubjectJourneyDetail(input.context, input.journeyId);
  return detail.ok ? detail : detail;
}

export async function markNotebookNotesReviewed(
  context: LearnMobileStudentContext,
  journeyId: string,
  elapsedSeconds?: number
) {
  return updateJourneyStep({
    context,
    journeyId,
    stepKey: "notebook_notes",
    status: "completed",
    progressPercent: 100,
    elapsedSeconds,
    metadata: { action: "notes_reviewed" },
  });
}
