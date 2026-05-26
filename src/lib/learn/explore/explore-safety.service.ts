import type {
  ExploreAiGenerationOutput,
  GuidedAdventureContentV2,
} from "@/lib/learn/explore/explore-schemas";
import type {
  ExploreLessonBrief,
  ExploreSafetyCheck,
  ExploreSafetyResult,
} from "@/lib/learn/explore/explore-types";

export const EXPLORE_MAX_SAFETY_REPAIR_ATTEMPTS = 2;

export type ExploreSafetyReviewOutcome =
  | "passed"
  | "needs_rewrite"
  | "blocked"
  | "teacher_review_required";

export interface ExploreSafetyReview {
  outcome: ExploreSafetyReviewOutcome;
  checks: ExploreSafetyCheck[];
  finalNotes: string[];
  failedCheckNames: string[];
}

const EXTERNAL_LINK_PATTERN =
  /\bhttps?:\/\/|www\.|\b[a-z0-9.-]+\.(com|org|net|edu|io)\b/i;

const UNSAFE_ACTIVITY_PATTERN =
  /\b(make|build|mix|drink|eat|swallow|inject|burn|explod|weapon|knife|acid|bleach|petrol|gasoline)\b.{0,40}\b(without|unsupervised|alone)\b/i;

const BLOCKED_CONTENT_PATTERN =
  /\b(porn|sexual intercourse|nude|suicide method|kill yourself|self-harm how|terrorist|genocide how to)\b/i;

const POLITICAL_RELIGIOUS_PATTERN =
  /\b(vote for|elect this party|only true religion|convert to|against all muslims|against all christians)\b/i;

const BULLYING_PATTERN =
  /\b(stupid students|you are dumb|worthless|idiot classmate)\b/i;

const HOMEWORK_COMPLETION_PATTERN =
  /\b(here is the answer|copy this answer|submit this homework|final answer is)\b/i;

const PRIVACY_PATTERN =
  /\b(password|home address|phone number|whatsapp number|bank account)\b/i;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenSet(text: string, minLen = 4) {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= minLen)
  );
}

function repetitionOverlapRatio(contentText: string, classroomBrief: string) {
  const contentTokens = tokenSet(contentText);
  const lessonTokens = tokenSet(classroomBrief);
  if (contentTokens.size === 0 || lessonTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of contentTokens) {
    if (lessonTokens.has(token)) overlap += 1;
  }

  return overlap / contentTokens.size;
}

/** Flatten generated adventure text for heuristic safety scans. */
export function collectExploreContentText(
  content: ExploreAiGenerationOutput | GuidedAdventureContentV2
) {
  const parts: string[] = [
    content.title,
    content.intro,
    content.adventureAngle,
    content.studentPromise,
    content.deepDiveExplanation.conceptBridge,
    content.deepDiveExplanation.deeperExplanation,
    content.deepDiveExplanation.realWorldConnection,
    ...(content.misconceptions ?? []).flatMap((m) => [
      m.misconception,
      m.leoCorrection,
    ]),
    ...(content.readingTasks ?? []).flatMap((r) => [r.title, r.passage]),
    ...(content.funFacts ?? []).flatMap((f) => [f.fact, f.whyItMatters]),
    ...(content.vocabulary ?? []).flatMap((v) => [v.meaning, v.simpleExample]),
    ...(content.endingQuiz?.questions ?? []).flatMap((q) => [q.prompt, q.explanation]),
    ...(content.checkpoints ?? []).map((c) => c.prompt),
    ...(content.leoPrompts ?? []),
  ];

  return parts.filter(Boolean).join("\n");
}

function check(
  name: string,
  passed: boolean,
  severity: ExploreSafetyCheck["severity"],
  note?: string
): ExploreSafetyCheck {
  return { name, passed, severity, note };
}

export function reviewExploreContentSafety(input: {
  content: ExploreAiGenerationOutput | GuidedAdventureContentV2;
  lessonBrief: ExploreLessonBrief;
  gradeName: string;
}): ExploreSafetyReview {
  const text = collectExploreContentText(input.content);
  const normalized = normalizeText(text);
  const checks: ExploreSafetyCheck[] = [];

  checks.push(
    check(
      "external_links",
      !EXTERNAL_LINK_PATTERN.test(text),
      "critical",
      "Remove URLs, domains, and link-like text."
    )
  );

  checks.push(
    check(
      "unsafe_activities",
      !UNSAFE_ACTIVITY_PATTERN.test(normalized),
      "critical",
      "Remove unsafe or unsupervised activity instructions."
    )
  );

  checks.push(
    check(
      "blocked_content",
      !BLOCKED_CONTENT_PATTERN.test(normalized),
      "critical",
      "Remove adult, violent, or harmful content."
    )
  );

  checks.push(
    check(
      "political_religious_persuasion",
      !POLITICAL_RELIGIOUS_PATTERN.test(normalized),
      "critical",
      "Avoid political or religious persuasion."
    )
  );

  checks.push(
    check(
      "bullying_shaming",
      !BULLYING_PATTERN.test(normalized),
      "critical",
      "Use encouraging tone without shaming students."
    )
  );

  checks.push(
    check(
      "homework_completion",
      !HOMEWORK_COMPLETION_PATTERN.test(normalized),
      "warning",
      "Do not provide direct homework answers."
    )
  );

  checks.push(
    check(
      "privacy_leakage",
      !PRIVACY_PATTERN.test(normalized),
      "warning",
      "Do not request or expose private contact or credential data."
    )
  );

  const overlap = repetitionOverlapRatio(text, input.lessonBrief.classroomBrief);
  checks.push(
    check(
      "lesson_repetition",
      overlap < 0.42,
      overlap >= 0.55 ? "critical" : "warning",
      `Lesson overlap ratio ${(overlap * 100).toFixed(0)}% (should stay low).`
    )
  );

  checks.push(
    check(
      "misconceptions_present",
      (input.content.misconceptions?.length ?? 0) >= 1,
      "warning",
      "Include at least one misconception with a gentle correction."
    )
  );

  const hasDeepDive =
    Boolean(input.content.deepDiveExplanation?.deeperExplanation?.trim()) &&
    Boolean(input.content.deepDiveExplanation?.realWorldConnection?.trim());

  checks.push(
    check(
      "deeper_explanation",
      hasDeepDive,
      "warning",
      "Include deeper explanation and a real-world connection."
    )
  );

  const hasRealWorld =
    /\b(ghana|africa|community|market|farm|school|home|everyday|real life|real-world)\b/i.test(
      text
    );

  checks.push(
    check(
      "real_world_connection",
      hasRealWorld,
      "info",
      "Add a relatable Ghanaian/African or everyday example where possible."
    )
  );

  const gradeLower = normalizeText(input.gradeName);
  const tooAdvanced =
    /\b(university thesis|phd|calculus proof|quantum mechanics)\b/i.test(normalized) &&
    (gradeLower.includes("primary") ||
      gradeLower.includes("kg") ||
      gradeLower.includes("nursery") ||
      gradeLower.includes("jhs 1"));

  checks.push(
    check(
      "grade_appropriate",
      !tooAdvanced,
      tooAdvanced ? "warning" : "info",
      "Content should match the stated grade level."
    )
  );

  if (input.content.tryItActivity?.safetyLevel === "teacher_only") {
    checks.push(
      check(
        "try_it_supervision",
        (input.content.tryItActivity.instructions ?? []).every((line) =>
          /\b(teacher|adult|supervis)/i.test(line)
        ),
        "warning",
        "Teacher-only activities should mention supervision in instructions."
      )
    );
  }

  const failedCritical = checks.filter((c) => !c.passed && c.severity === "critical");
  const failedWarnings = checks.filter((c) => !c.passed && c.severity === "warning");
  const failedCheckNames = checks.filter((c) => !c.passed).map((c) => c.name);

  const finalNotes: string[] = [];
  if (failedCritical.length) {
    finalNotes.push("Critical safety checks failed.");
  }
  if (failedWarnings.length) {
    finalNotes.push("Some quality or policy warnings need a rewrite.");
  }

  let outcome: ExploreSafetyReviewOutcome = "passed";
  if (failedCritical.length) {
    outcome = "blocked";
  } else if (failedWarnings.length) {
    outcome = "needs_rewrite";
  } else if (checks.some((c) => c.name === "real_world_connection" && !c.passed)) {
    outcome = "teacher_review_required";
  }

  return {
    outcome,
    checks,
    finalNotes,
    failedCheckNames,
  };
}

export function toExploreSafetyResult(
  review: ExploreSafetyReview,
  repairAttempts: number
): ExploreSafetyResult {
  let status: ExploreSafetyResult["status"] = "passed";
  if (review.outcome === "blocked") {
    status = "blocked";
  } else if (review.outcome === "teacher_review_required") {
    status = "teacher_review_required";
  } else if (repairAttempts > 0 && review.outcome === "passed") {
    status = "repaired";
  }

  return {
    status,
    checks: review.checks,
    repairAttempts,
    finalNotes: review.finalNotes,
  };
}
