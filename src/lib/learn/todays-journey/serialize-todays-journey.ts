import type { Types } from "mongoose";
import type { ILearnSubjectJourney } from "@/models/LearnSubjectJourney";

import {
  computeJourneyCompletion,
  coveredLabelWithTeacher,
  currentStepKey,
  formatCoveredLabel,
  journeyRoute,
  JOURNEY_TIMEZONE,
  STREAK_PROTECTION_PERCENT,
  STEP_LABELS,
  timeOfDayGreeting,
} from "./journey-step-utils";

export type MobileJourneyStepSummary = {
  key: string;
  label: string;
  status: string;
  required: boolean;
  progressPercent: number;
};

export type MobileSubjectJourneySummary = {
  id: string;
  lessonSessionId: string;
  subjectId?: string;
  subjectName: string;
  topicTitle: string;
  teacherName?: string;
  coveredAt: string;
  coveredLabel: string;
  status: string;
  required: boolean;
  displayOrder: number;
  priorityReason: string;
  completionPercent: number;
  currentStepKey?: string;
  estimatedMinutes: number;
  xpEarned: number;
  xpAvailable: number;
  steps: MobileJourneyStepSummary[];
  route: string;
  routeParams?: Record<string, string>;
};

export type MobileJourneyAssignmentSummary = {
  id: string;
  title: string;
  subjectName: string;
  dueLabel: string;
  dueAt?: string;
  status: "not_started" | "in_progress" | "submitted" | "overdue";
  route: string;
};

export type MobileTodayJourneyResponse = {
  id: string;
  date: string;
  timezone: string;
  title: string;
  greeting: string;
  status: "empty" | "not_started" | "in_progress" | "streak_protected" | "completed";
  summary: {
    subjectsCovered: number;
    subjectJourneysTotal: number;
    subjectJourneysCompleted: number;
    requiredStepsCompleted: number;
    requiredStepsTotal: number;
    completionPercent: number;
    streakProtectionPercent: number;
    streakProtected: boolean;
    totalEstimatedMinutes: number;
    xpEarned: number;
    totalXpAvailable: number;
  };
  nextBestStep?: {
    type: "subject_journey" | "catch_up" | "assignment" | "exam_prep" | "leo_rescue";
    title: string;
    subtitle: string;
    ctaLabel: string;
    route: string;
    routeParams?: Record<string, string>;
    estimatedMinutes?: number;
    xpReward?: number;
    urgency: "low" | "normal" | "high";
  };
  subjectJourneys: MobileSubjectJourneySummary[];
  catchUp: {
    count: number;
    pressure: "none" | "light" | "moderate" | "recovery";
    message: string;
    items: MobileSubjectJourneySummary[];
  };
  assignmentsDueSoon: MobileJourneyAssignmentSummary[];
  examPrep?: null;
  rewards: {
    streakMessage: string;
    perfectDayAvailable: boolean;
    rewardChestAvailable: boolean;
  };
};

export function serializeSubjectJourneySummary(
  journey: ILearnSubjectJourney
): MobileSubjectJourneySummary {
  const journeyId = String(journey._id);
  const metrics = computeJourneyCompletion(journey.steps);
  const coveredLabel = coveredLabelWithTeacher(
    formatCoveredLabel(journey.coveredAt),
    journey.teacherName
  );

  return {
    id: journeyId,
    lessonSessionId: String(journey.lessonSessionId),
    subjectId: journey.subjectId ? String(journey.subjectId) : undefined,
    subjectName: journey.subjectName,
    topicTitle: journey.topicTitle,
    teacherName: journey.teacherName ?? undefined,
    coveredAt: journey.coveredAt.toISOString(),
    coveredLabel,
    status: journey.status,
    required: journey.required,
    displayOrder: journey.displayOrder,
    priorityReason: journey.priorityReason,
    completionPercent: journey.completionPercent,
    currentStepKey: currentStepKey(journey.steps),
    estimatedMinutes: metrics.estimatedMinutes,
    xpEarned: journey.xpEarned,
    xpAvailable: journey.totalXpAvailable,
    steps: journey.steps.map((step) => ({
      key: step.key,
      label: STEP_LABELS[step.key],
      status: step.status,
      required: step.required,
      progressPercent: step.progressPercent,
    })),
    route: journeyRoute(journeyId),
    routeParams: { journeyId },
  };
}

function catchUpPressure(count: number): MobileTodayJourneyResponse["catchUp"]["pressure"] {
  if (count <= 0) return "none";
  if (count === 1) return "light";
  if (count <= 3) return "moderate";
  return "recovery";
}

function deriveBoardStatus(input: {
  journeys: ILearnSubjectJourney[];
  completionPercent: number;
}): MobileTodayJourneyResponse["status"] {
  if (input.journeys.length === 0) return "empty";
  if (input.completionPercent >= 100) return "completed";
  if (input.completionPercent >= STREAK_PROTECTION_PERCENT) return "streak_protected";
  if (input.journeys.some((journey) => journey.status === "in_progress")) return "in_progress";
  return "not_started";
}

function buildNextBestStep(input: {
  journeys: MobileSubjectJourneySummary[];
  catchUpItems: MobileSubjectJourneySummary[];
  assignments: MobileJourneyAssignmentSummary[];
}): MobileTodayJourneyResponse["nextBestStep"] | undefined {
  const activeJourney =
    input.journeys.find((journey) => journey.status === "in_progress") ??
    input.journeys.find((journey) => journey.status === "available" || journey.status === "not_started");

  if (activeJourney) {
    const stepLabel = activeJourney.currentStepKey
      ? STEP_LABELS[activeJourney.currentStepKey as keyof typeof STEP_LABELS]
      : "Notes";

    return {
      type: "subject_journey",
      title: `Continue ${activeJourney.subjectName}`,
      subtitle: `${activeJourney.topicTitle} — ${stepLabel} step is waiting`,
      ctaLabel: activeJourney.status === "in_progress" ? "Continue journey" : "Start journey",
      route: activeJourney.route,
      routeParams: activeJourney.routeParams,
      estimatedMinutes: activeJourney.estimatedMinutes,
      xpReward: activeJourney.xpAvailable,
      urgency: "normal",
    };
  }

  const catchUp = input.catchUpItems[0];
  if (catchUp) {
    return {
      type: "catch_up",
      title: `Catch up on ${catchUp.subjectName}`,
      subtitle: catchUp.topicTitle,
      ctaLabel: "Open catch-up",
      route: catchUp.route,
      routeParams: catchUp.routeParams,
      estimatedMinutes: catchUp.estimatedMinutes,
      xpReward: catchUp.xpAvailable,
      urgency: "low",
    };
  }

  const assignment = input.assignments[0];
  if (assignment) {
    return {
      type: "assignment",
      title: assignment.title,
      subtitle: `${assignment.subjectName} • ${assignment.dueLabel}`,
      ctaLabel: "View assignment",
      route: assignment.route,
      urgency: assignment.status === "overdue" ? "high" : "normal",
    };
  }

  return undefined;
}

export function serializeTodayJourney(input: {
  dateKey: string;
  displayName: string;
  journeys: ILearnSubjectJourney[];
  catchUpJourneys: ILearnSubjectJourney[];
  assignmentsDueSoon: MobileJourneyAssignmentSummary[];
  boardId: Types.ObjectId | null;
}): MobileTodayJourneyResponse {
  const subjectJourneys = input.journeys.map(serializeSubjectJourneySummary);
  const catchUpItems = input.catchUpJourneys.map(serializeSubjectJourneySummary);

  const requiredStepsCompleted = [...input.journeys, ...input.catchUpJourneys].reduce(
    (sum, journey) => sum + computeJourneyCompletion(journey.steps).requiredStepsCompleted,
    0
  );
  const requiredStepsTotal = [...input.journeys, ...input.catchUpJourneys].reduce(
    (sum, journey) => sum + computeJourneyCompletion(journey.steps).requiredStepsTotal,
    0
  );

  const totalEstimatedMinutes = subjectJourneys.reduce(
    (sum, journey) => sum + journey.estimatedMinutes,
    0
  );
  const xpEarned = subjectJourneys.reduce((sum, journey) => sum + journey.xpEarned, 0);
  const totalXpAvailable = subjectJourneys.reduce((sum, journey) => sum + journey.xpAvailable, 0);

  const subjectJourneysCompleted = subjectJourneys.filter(
    (journey) => journey.status === "completed"
  ).length;

  const completionPercent =
    requiredStepsTotal === 0
      ? 0
      : Math.round((requiredStepsCompleted / requiredStepsTotal) * 100);

  const streakProtected = completionPercent >= STREAK_PROTECTION_PERCENT;
  const status = deriveBoardStatus({ journeys: input.journeys, completionPercent });

  const lessonCount = input.journeys.length;
  const greetingPrefix = `${timeOfDayGreeting()}, ${input.displayName} 👋`;

  const greeting =
    lessonCount === 0
      ? `${greetingPrefix}\nYour journey will appear after your teacher covers lessons today.`
      : `${greetingPrefix}\nYou had ${lessonCount} lesson${lessonCount === 1 ? "" : "s"} today.\nLeo prepared your after-class journey.`;

  const catchUpCount = catchUpItems.length;
  const catchUpMessage =
    catchUpCount === 0
      ? "No saved catch-up items yet."
      : catchUpCount === 1
        ? "One saved journey is waiting in your Catch-up Vault."
        : `${catchUpCount} saved journeys are waiting in your Catch-up Vault.`;

  const nextBestStep = buildNextBestStep({
    journeys: subjectJourneys,
    catchUpItems,
    assignments: input.assignmentsDueSoon,
  });

  return {
    id: input.boardId ? String(input.boardId) : `journey-${input.dateKey}`,
    date: input.dateKey,
    timezone: JOURNEY_TIMEZONE,
    title: "Today’s Journey",
    greeting,
    status,
    summary: {
      subjectsCovered: lessonCount,
      subjectJourneysTotal: subjectJourneys.length,
      subjectJourneysCompleted,
      requiredStepsCompleted,
      requiredStepsTotal,
      completionPercent,
      streakProtectionPercent: STREAK_PROTECTION_PERCENT,
      streakProtected,
      totalEstimatedMinutes,
      xpEarned,
      totalXpAvailable,
    },
    nextBestStep,
    subjectJourneys,
    catchUp: {
      count: catchUpCount,
      pressure: catchUpPressure(catchUpCount),
      message: catchUpMessage,
      items: catchUpItems,
    },
    assignmentsDueSoon: input.assignmentsDueSoon,
    examPrep: null,
    rewards: {
      streakMessage: streakProtected
        ? "Your learning streak is protected today."
        : `Finish more required steps to reach ${STREAK_PROTECTION_PERCENT}% streak protection.`,
      perfectDayAvailable: subjectJourneys.length > 0 && completionPercent < 100,
      rewardChestAvailable: completionPercent >= 100,
    },
  };
}
