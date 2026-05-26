import { z } from "zod";

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const exploreDifficultySchema = z.enum(["easy", "standard", "stretch"]);

export const exploreMissionTypeSchema = z.enum([
  "detective",
  "field_trip",
  "story_lab",
  "maker_challenge",
  "culture_link",
  "home_lab",
  "career_link",
  "ghana_connection",
  "future_world",
  "mistake_buster",
  "leo_rescue",
  "parent_challenge",
]);

export const exploreCategorySchema = z.enum(["based_on_lesson", "go_deeper"]);

const deepDiveExplanationSchema = z.object({
  title: nonEmpty(120),
  conceptBridge: nonEmpty(600),
  deeperExplanation: nonEmpty(1200),
  realWorldConnection: nonEmpty(800),
});

const misconceptionSchema = z.object({
  id: nonEmpty(64),
  misconception: nonEmpty(280),
  whyStudentsThinkThis: nonEmpty(400),
  leoCorrection: nonEmpty(500),
  quickCheckPrompt: nonEmpty(280),
});

const tryItActivitySchema = z.object({
  id: nonEmpty(64),
  title: nonEmpty(120),
  type: z.enum(["observe", "draw", "discuss", "mini_experiment", "think"]),
  safetyLevel: z.enum(["safe_independent", "needs_adult", "teacher_only"]),
  instructions: z.array(nonEmpty(320)).min(2).max(8),
  reflectionPrompt: nonEmpty(320),
});

const parentConversationPromptSchema = z.object({
  title: nonEmpty(120),
  prompt: nonEmpty(400),
  expectedLearningOutcome: nonEmpty(400),
});

const curiosityPathwaySchema = z.object({
  id: nonEmpty(64),
  label: nonEmpty(80),
  description: nonEmpty(400),
  nextAdventurePrompt: nonEmpty(400),
});

const vocabularyWordSchema = z.object({
  id: nonEmpty(64),
  word: nonEmpty(80),
  meaning: nonEmpty(280),
  simpleExample: nonEmpty(280),
  pronunciation: nonEmpty(80).optional(),
});

const readingTaskSchema = z.object({
  id: nonEmpty(64),
  title: nonEmpty(120),
  passage: nonEmpty(2200),
  readingLevel: nonEmpty(80),
  questions: z.array(nonEmpty(280)).min(1).max(4),
});

const funFactSchema = z.object({
  id: nonEmpty(64),
  headline: nonEmpty(80),
  fact: nonEmpty(500),
  whyItMatters: nonEmpty(280),
});

const checkpointSchema = z.object({
  id: nonEmpty(64),
  type: z.enum(["quiz", "reflection", "vocabulary", "leo_prompt", "fun_fact"]),
  prompt: nonEmpty(400),
});

const quizOptionSchema = z.object({
  id: nonEmpty(64),
  letter: z.enum(["A", "B", "C", "D"]),
  label: nonEmpty(320),
});

const quizQuestionSchema = z
  .object({
    id: nonEmpty(64),
    prompt: nonEmpty(400),
    options: z.array(quizOptionSchema).length(4),
    correctOptionId: nonEmpty(64),
    explanation: nonEmpty(500),
  })
  .superRefine((question, ctx) => {
    const optionIds = new Set(question.options.map((option) => option.id));
    if (!optionIds.has(question.correctOptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctOptionId must match one of the option ids",
        path: ["correctOptionId"],
      });
    }

    const letters = question.options.map((option) => option.letter);
    if (new Set(letters).size !== letters.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quiz option letters must be unique",
        path: ["options"],
      });
    }
  });

const endingQuizSchema = z.object({
  id: nonEmpty(64),
  title: nonEmpty(120),
  questions: z.array(quizQuestionSchema).min(4).max(6),
});

/** Fields the AI must return before server adds sourceLessonId / ids. */
export const exploreAiGenerationOutputSchema = z.object({
  title: nonEmpty(160),
  subjectName: nonEmpty(80),
  sourceLessonTitle: nonEmpty(160),
  gradeName: nonEmpty(80),
  difficulty: exploreDifficultySchema,
  estimatedMinutes: z.number().int().min(6).max(20),
  missionType: exploreMissionTypeSchema,
  adventureAngle: nonEmpty(400),
  studentPromise: nonEmpty(320),
  intro: nonEmpty(800),
  category: exploreCategorySchema.optional(),
  deepDiveExplanation: deepDiveExplanationSchema,
  misconceptions: z.array(misconceptionSchema).min(1).max(4),
  tryItActivity: tryItActivitySchema.optional(),
  parentConversationPrompt: parentConversationPromptSchema.optional(),
  curiosityPathways: z.array(curiosityPathwaySchema).min(1).max(4),
  vocabulary: z.array(vocabularyWordSchema).min(1).max(8),
  readingTasks: z.array(readingTaskSchema).min(1).max(4).optional(),
  funFacts: z.array(funFactSchema).min(2).max(6).optional(),
  checkpoints: z.array(checkpointSchema).min(1).max(6).optional(),
  endingQuiz: endingQuizSchema,
  leoPrompts: z.array(nonEmpty(200)).min(2).max(6).optional(),
});

/** Full snapshot payload stored on ExploreContentSnapshot.content. */
export const guidedAdventureContentV2Schema = exploreAiGenerationOutputSchema.extend({
  sourceLessonId: nonEmpty(80),
});

export const exploreSourceContextSchema = z.object({
  schoolId: nonEmpty(64),
  classGroupId: nonEmpty(64),
  subjectId: nonEmpty(64),
  lessonId: nonEmpty(64),
  lessonTitle: nonEmpty(160),
  gradeLevel: nonEmpty(80),
  curriculum: nonEmpty(120).optional(),
  academicYearId: nonEmpty(64).optional(),
  termId: nonEmpty(64).optional(),
});

export const exploreAiMetadataSchema = z.object({
  provider: nonEmpty(40),
  model: nonEmpty(80),
  promptVersion: nonEmpty(40),
  generatedBy: z.literal("backend_ai"),
  generationPromptSummary: nonEmpty(500),
  temperature: z.number().min(0).max(2).optional(),
});

export const exploreSafetyCheckSchema = z.object({
  name: nonEmpty(80),
  passed: z.boolean(),
  severity: z.enum(["info", "warning", "critical"]),
  note: nonEmpty(400).optional(),
});

export const exploreSafetyResultSchema = z.object({
  status: z.enum(["passed", "repaired", "blocked", "teacher_review_required"]),
  checks: z.array(exploreSafetyCheckSchema).min(1),
  repairAttempts: z.number().int().min(0).max(5),
  finalNotes: z.array(nonEmpty(400)).max(12),
});

export type ExploreAiGenerationOutput = z.infer<typeof exploreAiGenerationOutputSchema>;
export type GuidedAdventureContentV2 = z.infer<typeof guidedAdventureContentV2Schema>;
export type ExploreSourceContextParsed = z.infer<typeof exploreSourceContextSchema>;
export type ExploreAiMetadataParsed = z.infer<typeof exploreAiMetadataSchema>;
export type ExploreSafetyResultParsed = z.infer<typeof exploreSafetyResultSchema>;

export type ExploreValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: z.ZodIssue[]; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeId(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    const parts = value
      .split(/\n+|(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts : [value.trim(), ...fallback.slice(1)];
  }

  return fallback;
}

function normalizeRowsWithIds(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => {
    const record = asRecord(row);
    if (!record) return row;
    return {
      ...record,
      id: normalizeId(record.id, `${prefix}-${index + 1}`),
    };
  });
}

function normalizeTryItActivity(value: unknown) {
  const record = asRecord(value);
  if (!record) return value;

  return {
    ...record,
    id: normalizeId(record.id, "try-it-1"),
    type:
      typeof record.type === "string" &&
      ["observe", "draw", "discuss", "mini_experiment", "think"].includes(record.type)
        ? record.type
        : "think",
    safetyLevel:
      typeof record.safetyLevel === "string" &&
      ["safe_independent", "needs_adult", "teacher_only"].includes(record.safetyLevel)
        ? record.safetyLevel
        : "safe_independent",
    instructions: normalizeStringArray(record.instructions, [
      "Read the adventure again and pick one idea Leo explained.",
      "Write or say one safe example from home, school, or your community.",
    ]).slice(0, 8),
  };
}

function normalizeReadingTasks(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => {
    const record = asRecord(row);
    if (!record) return row;
    return {
      ...record,
      id: normalizeId(record.id, `reading-${index + 1}`),
      questions: normalizeStringArray(record.questions, [
        "What new idea did this reading add?",
      ]).slice(0, 4),
    };
  });
}

function normalizeEndingQuiz(value: unknown) {
  const quiz = asRecord(value);
  if (!quiz) return value;

  const letters = ["A", "B", "C", "D"] as const;
  const questions = Array.isArray(quiz.questions) ? [...quiz.questions] : [];

  while (questions.length < 4) {
    const questionNumber = questions.length + 1;
    questions.push({
      id: `quiz-q${questionNumber}`,
      prompt: "Which habit helps you learn from this Explore adventure?",
      options: letters.map((letter) => ({
        id: `quiz-q${questionNumber}-${letter}`,
        letter,
        label:
          letter === "A"
            ? "Connect the new idea to a real example."
            : `Choice ${letter}`,
      })),
      correctOptionId: `quiz-q${questionNumber}-A`,
      explanation: "Connecting new ideas to real examples helps the learning stick.",
    });
  }

  return {
    ...quiz,
    id: normalizeId(quiz.id, "ending-quiz"),
    questions: questions.slice(0, 6).map((row, questionIndex) => {
      const question = asRecord(row);
      if (!question) return row;
      const normalizedQuestionId = normalizeId(question.id, `quiz-q${questionIndex + 1}`);
      const options = Array.isArray(question.options) ? question.options.slice(0, 4) : [];
      while (options.length < 4) {
        const letter = letters[options.length];
        options.push({ id: `${normalizedQuestionId}-${letter}`, letter, label: `Choice ${letter}` });
      }

      const normalizedOptions = options.map((option, optionIndex) => {
        const optionRecord = asRecord(option) ?? {};
        const letter = letters[optionIndex];
        return {
          ...optionRecord,
          id: normalizeId(optionRecord.id, `${normalizedQuestionId}-${letter}`),
          letter,
        };
      });
      const optionIds = new Set(normalizedOptions.map((option) => option.id));
      const correctOptionId =
        typeof question.correctOptionId === "string" && optionIds.has(question.correctOptionId)
          ? question.correctOptionId
          : normalizedOptions[0]?.id;

      return {
        ...question,
        id: normalizedQuestionId,
        options: normalizedOptions,
        correctOptionId,
      };
    }),
  };
}

function normalizeExploreAiRaw(raw: unknown) {
  const record = asRecord(raw);
  if (!record) return raw;

  return {
    ...record,
    misconceptions: normalizeRowsWithIds(record.misconceptions, "misconception"),
    tryItActivity: normalizeTryItActivity(record.tryItActivity),
    curiosityPathways: normalizeRowsWithIds(record.curiosityPathways, "curiosity"),
    vocabulary: normalizeRowsWithIds(record.vocabulary, "vocab"),
    readingTasks: normalizeReadingTasks(record.readingTasks),
    funFacts: normalizeRowsWithIds(record.funFacts, "fact"),
    checkpoints: normalizeRowsWithIds(record.checkpoints, "checkpoint"),
    endingQuiz: normalizeEndingQuiz(record.endingQuiz),
  };
}

function formatZodIssues(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function validateExploreAiOutput(
  raw: unknown
): ExploreValidationResult<ExploreAiGenerationOutput> {
  const parsed = exploreAiGenerationOutputSchema.safeParse(normalizeExploreAiRaw(raw));
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues,
      message: formatZodIssues(parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateGuidedAdventureContentV2(
  raw: unknown
): ExploreValidationResult<GuidedAdventureContentV2> {
  const parsed = guidedAdventureContentV2Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues,
      message: formatZodIssues(parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Merge AI output with server-owned lesson binding fields. */
export function buildGuidedAdventureContentV2(input: {
  ai: ExploreAiGenerationOutput;
  sourceLessonId: string;
}): ExploreValidationResult<GuidedAdventureContentV2> {
  return validateGuidedAdventureContentV2({
    ...input.ai,
    sourceLessonId: input.sourceLessonId,
  });
}

export function validateExploreSourceContext(
  raw: unknown
): ExploreValidationResult<ExploreSourceContextParsed> {
  const parsed = exploreSourceContextSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues,
      message: formatZodIssues(parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateExploreSafetyResult(
  raw: unknown
): ExploreValidationResult<ExploreSafetyResultParsed> {
  const parsed = exploreSafetyResultSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues,
      message: formatZodIssues(parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}
