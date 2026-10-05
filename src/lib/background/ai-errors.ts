import { BackgroundJobError } from "./errors";

const PERMANENT_PATTERNS = [
  /invalid[_ ]model/i,
  /model_not_found/i,
  /does not have access to model/i,
  /unsupported/i,
  /policy/i,
  /content[_ ]filter/i,
  /safety/i,
  /malformed/i,
  /invalid[_ ]request/i,
  /missing prerequisite/i,
  /not found/i,
];

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /429/,
  /rate limit/i,
  /overloaded/i,
  /503/,
  /502/,
  /500/,
  /529/,
  /temporarily/i,
  /try again/i,
];

export function classifyAiProviderError(error: unknown): BackgroundJobError {
  const message = error instanceof Error ? error.message : String(error || "AI provider failed");
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : NaN;

  if (status === 429 || status >= 500) {
    return new BackgroundJobError({
      message,
      category: "RETRYABLE",
      code: "AI_PROVIDER_TRANSIENT",
    });
  }
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
    return new BackgroundJobError({
      message,
      category: "PERMANENT",
      code: "AI_PROVIDER_PERMANENT",
    });
  }
  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) {
    return new BackgroundJobError({
      message,
      category: "RETRYABLE",
      code: "AI_PROVIDER_TRANSIENT",
    });
  }
  if (PERMANENT_PATTERNS.some((pattern) => pattern.test(message))) {
    return new BackgroundJobError({
      message,
      category: "PERMANENT",
      code: "AI_PROVIDER_PERMANENT",
    });
  }
  return new BackgroundJobError({
    message,
    category: "RETRYABLE",
    code: "AI_PROVIDER_TRANSIENT",
  });
}

export function lessonGenerationPrerequisiteError(message: string): BackgroundJobError {
  return new BackgroundJobError({
    message,
    category: "PREREQUISITE_FAILED",
    code: "AI_PREREQUISITE_FAILED",
  });
}

export function lessonGenerationPermanentError(message: string, code = "AI_VALIDATION_FAILED") {
  return new BackgroundJobError({
    message,
    category: "PERMANENT",
    code,
  });
}
