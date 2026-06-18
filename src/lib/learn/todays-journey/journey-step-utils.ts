import type {
  ILearnJourneyStepProgress,
  ILearnSubjectJourney,
  LearnJourneyStepKey,
} from "@/models/LearnSubjectJourney";

export const JOURNEY_TIMEZONE = "Africa/Accra";
export const STREAK_PROTECTION_PERCENT = 60;

export const STEP_LABELS: Record<LearnJourneyStepKey, string> = {
  notebook_notes: "Notes",
  flashcards: "Flashcards",
  explore: "Explore",
  extra_ai: "Leo",
  assignment: "Assignment",
  reflection: "Reflect",
};

export function dateKeyForSchoolDay(date: Date, timezone = JOURNEY_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function startOfSchoolDay(dateKey: string, timezone = JOURNEY_TIMEZONE) {
  return new Date(`${dateKey}T00:00:00.000+00:00`);
}

export function formatCoveredLabel(date: Date) {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Covered today";
  if (diffDays === 1) return "Covered yesterday";
  if (diffDays < 7) return "Covered this week";
  return `Covered ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function buildDefaultJourneySteps(input: {
  hasFlashcards: boolean;
  hasAssignment: boolean;
}): ILearnJourneyStepProgress[] {
  return [
    {
      key: "notebook_notes",
      status: "available",
      required: true,
      estimatedMinutes: 5,
      xpReward: 15,
      progressPercent: 0,
    },
    {
      key: "flashcards",
      status: input.hasFlashcards ? "available" : "locked",
      required: input.hasFlashcards,
      estimatedMinutes: 8,
      xpReward: 25,
      progressPercent: 0,
    },
    {
      key: "explore",
      status: "available",
      required: false,
      estimatedMinutes: 6,
      xpReward: 20,
      progressPercent: 0,
    },
    {
      key: "extra_ai",
      status: "available",
      required: false,
      estimatedMinutes: 5,
      xpReward: 15,
      progressPercent: 0,
    },
    {
      key: "assignment",
      status: input.hasAssignment ? "available" : "locked",
      required: input.hasAssignment,
      estimatedMinutes: 10,
      xpReward: 30,
      progressPercent: 0,
    },
    {
      key: "reflection",
      status: "locked",
      required: true,
      estimatedMinutes: 2,
      xpReward: 10,
      progressPercent: 0,
    },
  ];
}

export function mergeJourneySteps(
  existing: ILearnJourneyStepProgress[],
  defaults: ILearnJourneyStepProgress[]
): ILearnJourneyStepProgress[] {
  const existingByKey = new Map(existing.map((step) => [step.key, step]));

  return defaults.map((defaultStep) => {
    const current = existingByKey.get(defaultStep.key);
    if (!current) return defaultStep;

    return {
      ...defaultStep,
      status: current.status,
      progressPercent: current.progressPercent,
      startedAt: current.startedAt ?? null,
      completedAt: current.completedAt ?? null,
      lastActivityAt: current.lastActivityAt ?? null,
      xpReward: current.xpReward || defaultStep.xpReward,
    };
  });
}

export function computeJourneyCompletion(steps: ILearnJourneyStepProgress[]) {
  const requiredSteps = steps.filter((step) => step.required);
  const requiredTotal = requiredSteps.length;
  const requiredCompleted = requiredSteps.filter((step) => step.status === "completed").length;

  const completionPercent =
    requiredTotal === 0
      ? 100
      : Math.round(
          requiredSteps.reduce((sum, step) => sum + step.progressPercent, 0) / requiredTotal
        );

  const xpEarned = steps
    .filter((step) => step.status === "completed")
    .reduce((sum, step) => sum + step.xpReward, 0);
  const totalXpAvailable = steps.reduce((sum, step) => sum + step.xpReward, 0);
  const estimatedMinutes = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);

  return {
    completionPercent,
    xpEarned,
    totalXpAvailable,
    estimatedMinutes,
    requiredStepsCompleted: requiredCompleted,
    requiredStepsTotal: requiredTotal,
  };
}

export function currentStepKey(steps: ILearnJourneyStepProgress[]): LearnJourneyStepKey | undefined {
  const inProgress = steps.find((step) => step.status === "in_progress");
  if (inProgress) return inProgress.key;

  const nextAvailable = steps.find(
    (step) => step.status === "available" || step.status === "not_started"
  );
  return nextAvailable?.key;
}

export function journeyRoute(journeyId: string) {
  return `/(student)/today/${encodeURIComponent(journeyId)}`;
}

export function coveredLabelWithTeacher(coveredLabel: string, teacherName?: string | null) {
  if (!teacherName) return coveredLabel;
  if (coveredLabel === "Covered today") return `Covered today by ${teacherName}`;
  if (coveredLabel === "Covered yesterday") return `Covered yesterday by ${teacherName}`;
  return coveredLabel;
}

export function deriveJourneyStatus(
  journey: Pick<ILearnSubjectJourney, "status" | "completionPercent" | "steps">
): ILearnSubjectJourney["status"] {
  if (journey.status === "saved_for_later" || journey.status === "moved_to_revision_bank") {
    return journey.status;
  }
  if (journey.completionPercent >= 100) return "completed";
  if (journey.steps.some((step) => step.status === "in_progress" || step.status === "completed")) {
    return "in_progress";
  }
  return journey.status === "locked" ? "locked" : "available";
}

export const VALID_JOURNEY_STEP_KEYS: LearnJourneyStepKey[] = [
  "notebook_notes",
  "flashcards",
  "explore",
  "extra_ai",
  "assignment",
  "reflection",
];

export function isValidJourneyStepKey(value: string): value is LearnJourneyStepKey {
  return VALID_JOURNEY_STEP_KEYS.includes(value as LearnJourneyStepKey);
}

export function syncStepLocks(steps: ILearnJourneyStepProgress[]): ILearnJourneyStepProgress[] {
  const reflection = steps.find((step) => step.key === "reflection");
  if (!reflection) return steps;

  const priorRequired = steps.filter((step) => step.key !== "reflection" && step.required);
  const allPriorDone = priorRequired.every(
    (step) => step.status === "completed" || step.status === "skipped"
  );

  if (reflection.status === "locked" && allPriorDone) {
    return steps.map((step) =>
      step.key === "reflection" ? { ...step, status: "available" } : step
    );
  }

  return steps;
}

export function timeOfDayGreeting(date = new Date(), timezone = JOURNEY_TIMEZONE) {
  const hour = Number(
    new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", hour12: false }).format(
      date
    )
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
