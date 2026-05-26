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

function hasStatus(error: unknown, status: number): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === status,
  );
}

function formatOpenAiConnectionError(combined: string): string | null {
  if (/enotfound|getaddrinfo|dns/.test(combined)) {
    return "OpenAI DNS lookup failed (api.openai.com could not be resolved). Check DNS, VPN, firewall, or sandbox network access.";
  }
  if (/econnrefused/.test(combined)) {
    return "OpenAI connection was refused before the API received the request. Check firewall, proxy, or outbound network rules.";
  }
  if (/econnreset|socket hang up/.test(combined)) {
    return "OpenAI connection was reset while sending the request. Check unstable internet, proxy, or VPN interruption.";
  }
  if (/etimedout|timeout|timed out/.test(combined)) {
    return "OpenAI request timed out (no response within 2 minutes). The API may be slow or unreachable from this server.";
  }
  if (/certificate|tls|ssl/.test(combined)) {
    return "OpenAI TLS/certificate connection failed. Check proxy, firewall inspection, or system certificates.";
  }
  if (/api connection error|fetch failed|network|connection error/.test(combined)) {
    return "OpenAI connection failed before an HTTP response was received. This is not an API-key or model rejection.";
  }
  return null;
}

export function formatOpenAiImportError(error: unknown): string {
  const parts = walkErrors(error);
  const combined = parts.join(" ").toLowerCase();

  if (
    /invalid_api_key|incorrect api key|invalid api key|authentication/.test(combined) ||
    hasStatus(error, 401)
  ) {
    return "Leo could not authenticate with OpenAI (invalid or expired API key).";
  }
  if (/model_not_found|model .* not found|does not exist/.test(combined)) {
    return "OpenAI model is not available for this API key (model_not_found). Set OPENAI_SCHEME_IMPORT_MODEL or use a key with gpt-4o / gpt-4o-mini access.";
  }
  if (hasStatus(error, 403) || /permission|forbidden|not authorized/.test(combined)) {
    return "OpenAI rejected the request because the key does not have access to this operation or model.";
  }
  if (/rate limit|429/.test(combined)) {
    return "OpenAI rate limit reached.";
  }
  const connectionError = formatOpenAiConnectionError(combined);
  if (connectionError) {
    return connectionError;
  }
  if (parts[0]) return parts[0];
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "OpenAI request failed";
}

export function formatGeminiImportError(error: unknown, httpStatus?: number): string {
  const parts = walkErrors(error);
  const combined = parts.join(" ").toLowerCase();
  const rawDetail = parts[0] || (error instanceof Error ? error.message : "");

  if (httpStatus === 401 || httpStatus === 403) {
    return "Gemini could not authenticate (invalid or missing API key).";
  }
  if (httpStatus === 429) {
    if (/quota|billing|exhausted|limit:\s*0/i.test(combined)) {
      return `Gemini API quota exceeded${rawDetail ? ` (${rawDetail})` : ""}. Enable billing or raise limits in Google AI Studio.`;
    }
    return `Gemini rate limit reached${rawDetail ? ` (${rawDetail})` : ""}. Wait a few minutes and retry.`;
  }

  if (/api key|permission|unauthenticated|401|403/.test(combined)) {
    return "Gemini could not authenticate (invalid or missing API key).";
  }
  if (/quota|billing|resource_exhausted|resource exhausted/.test(combined)) {
    return `Gemini API quota exceeded${rawDetail ? ` (${rawDetail})` : ""}. Check Google AI Studio quotas/billing.`;
  }
  if (/rate limit|429|too many requests/.test(combined)) {
    return `Gemini rate limit reached${rawDetail ? ` (${rawDetail})` : ""}.`;
  }
  if (/etimedout|timeout|timed out|aborterror/.test(combined)) {
    return "Gemini request timed out (no response within 2 minutes).";
  }
  if (/econnreset|econnrefused|enotfound|fetch failed|network/.test(combined)) {
    return "Gemini connection failed before an HTTP response was received.";
  }
  if (parts[0]) return parts[0];
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Gemini request failed";
}

export function isRetryableAiProviderError(error: unknown): boolean {
  const combined = [
    formatOpenAiImportError(error),
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

/** True when the provider rejected the call due to keys, auth, or model access — not PDF content. */
export function isAiConfigurationError(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  const m = message.toLowerCase();
  return (
    /not configured|missing openai_api_key|missing gemini|invalid or missing api key|invalid or expired api key/.test(
      m,
    ) ||
    /could not authenticate|api key not valid|does not have access to this operation or model/.test(m) ||
    /model_not_found|model is not available/.test(m)
  );
}

export function isOpenAiModelOrAccessError(error: unknown): boolean {
  const parts = walkErrors(error);
  const combined = parts.join(" ").toLowerCase();
  return (
    /model_not_found|model .* not found|does not have access|permission|forbidden|not authorized/.test(
      combined,
    ) ||
    hasStatus(error, 403) ||
    hasStatus(error, 404)
  );
}
