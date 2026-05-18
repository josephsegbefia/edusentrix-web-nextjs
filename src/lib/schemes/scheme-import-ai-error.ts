import "server-only";

function walkErrors(error: unknown): string[] {
  const messages: string[] = [];
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
    if (err.message?.trim()) messages.push(err.message.trim());
    if (err.error?.message?.trim()) messages.push(err.error.message.trim());
    if (err.code?.trim()) messages.push(err.code.trim());
    if (err.error?.code?.trim()) messages.push(err.error.code.trim());
    current = err.cause;
  }
  return messages;
}

export function formatOpenAiImportError(error: unknown): string {
  const parts = walkErrors(error);
  const combined = parts.join(" ").toLowerCase();

  if (
    /invalid_api_key|incorrect api key|invalid api key|authentication/.test(combined) ||
    (error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 401)
  ) {
    return "Leo could not authenticate with OpenAI (invalid or expired API key).";
  }
  if (/rate limit|429/.test(combined)) {
    return "OpenAI rate limit reached.";
  }
  if (/econnreset|etimedout|econnrefused|enotfound|fetch failed|socket hang up|network|connection error/.test(combined)) {
    return "Network connection to OpenAI was interrupted.";
  }
  if (parts[0]) return parts[0];
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "OpenAI request failed";
}

export function formatGeminiImportError(error: unknown, httpStatus?: number): string {
  if (httpStatus === 401 || httpStatus === 403) {
    return "Gemini could not authenticate (invalid or missing API key).";
  }
  if (httpStatus === 429) {
    return "Gemini rate limit reached.";
  }

  const parts = walkErrors(error);
  const combined = parts.join(" ").toLowerCase();

  if (/api key|permission|unauthenticated|401|403/.test(combined)) {
    return "Gemini could not authenticate (invalid or missing API key).";
  }
  if (/quota|rate limit|429|resource exhausted/.test(combined)) {
    return "Gemini rate limit or quota exceeded.";
  }
  if (/econnreset|etimedout|econnrefused|enotfound|fetch failed|network|timeout/.test(combined)) {
    return "Network connection to Gemini was interrupted.";
  }
  if (parts[0]) return parts[0];
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Gemini request failed";
}

export function isRetryableAiProviderError(error: unknown): boolean {
  const combined = [
    formatOpenAiImportError(error),
    formatGeminiImportError(error),
    ...walkErrors(error),
  ]
    .join(" ")
    .toLowerCase();
  return /econnreset|etimedout|econnrefused|fetch failed|connection|network|timeout|rate limit|429|503|502|500/.test(
    combined,
  );
}

export function isAiConnectivityError(message: string): boolean {
  return /connection|network|econnreset|fetch failed|interrupted|timeout/i.test(message);
}
