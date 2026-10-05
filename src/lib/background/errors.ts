export const BACKGROUND_ERROR_CATEGORIES = [
  "RETRYABLE",
  "PERMANENT",
  "CANCELLED",
  "PREREQUISITE_FAILED",
] as const;

export type BackgroundErrorCategory = (typeof BACKGROUND_ERROR_CATEGORIES)[number];

export const BACKGROUND_JOB_ERROR_MESSAGE_MAX = 280;

const SECRET_LIKE =
  /(api[_-]?key|secret|token|password|authorization|bearer|sk_live|sk_test|whsec_|re_)[^\s]*/gi;
const URL_LIKE = /https?:\/\/[^\s]+/gi;

export class BackgroundJobError extends Error {
  readonly category: BackgroundErrorCategory;
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: {
    message: string;
    category: BackgroundErrorCategory;
    code?: string;
  }) {
    super(input.message);
    this.name = "BackgroundJobError";
    this.category = input.category;
    this.code = input.code ?? input.category;
    this.retryable = input.category === "RETRYABLE";
  }
}

export function classifyBackgroundError(error: unknown): BackgroundErrorCategory {
  if (error instanceof BackgroundJobError) return error.category;
  if (error instanceof Error && error.name === "NonRetriableError") return "PERMANENT";
  return "RETRYABLE";
}

export function backgroundErrorCode(error: unknown): string {
  if (error instanceof BackgroundJobError) return error.code;
  if (error instanceof Error && error.name) return error.name;
  return "UNKNOWN";
}

export function sanitizeBackgroundErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Background job failed";
  const stripped = raw.replace(SECRET_LIKE, "[redacted]").replace(URL_LIKE, "[url]");
  if (stripped.length <= BACKGROUND_JOB_ERROR_MESSAGE_MAX) return stripped;
  return `${stripped.slice(0, BACKGROUND_JOB_ERROR_MESSAGE_MAX - 1)}…`;
}

export function isRetryableBackgroundError(error: unknown): boolean {
  return classifyBackgroundError(error) === "RETRYABLE";
}
