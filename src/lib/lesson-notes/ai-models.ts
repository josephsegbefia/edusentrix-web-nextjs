import "server-only";

const DEFAULT_MODEL = "gpt-4o-mini";

function isModelAccessError(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const err = current as {
      message?: string;
      status?: number;
      code?: string;
      cause?: unknown;
      error?: { message?: string; code?: string };
    };
    if (err.message?.trim()) parts.push(err.message.trim());
    if (err.code?.trim()) parts.push(err.code.trim());
    if (err.error?.code?.trim()) parts.push(err.error.code.trim());
    current = err.cause;
  }
  const combined = parts.join(" ").toLowerCase();
  return (
    combined.includes("model_not_found") ||
    combined.includes("does not have access to model") ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 403)
  );
}

/** Models to try for lesson-note AI, with mini fallback when a configured model is unavailable. */
export function lessonNotesAiModels(deep: boolean): string[] {
  const configured = (
    deep ? process.env.OPENAI_LESSON_NOTES_DEEP_MODEL : process.env.OPENAI_LESSON_NOTES_MODEL
  )?.trim();

  if (!configured) return [DEFAULT_MODEL];
  if (configured === DEFAULT_MODEL) return [DEFAULT_MODEL];
  return [configured, DEFAULT_MODEL];
}

export function formatLessonNotesAiError(error: unknown): string {
  if (isModelAccessError(error)) {
    return "Leo could not use the configured OpenAI model for lesson generation. Set OPENAI_LESSON_NOTES_DEEP_MODEL to a model your API key supports (for example gpt-4o-mini).";
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "AI generation failed";
}

export { isModelAccessError };
