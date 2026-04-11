import "server-only";

import type { EmailSensitivity } from "@/models/EmailMessage";

/**
 * Determine whether a message can be sent to an arbitrary (non-guardian) email address.
 * Guardian-only and high-sensitivity content must only go to verified guardian emails.
 */
export function canSendToRecipient(opts: {
  sensitivity: EmailSensitivity;
  recipientEmailVerified: boolean;
  recipientIsGuardian: boolean;
}): { allowed: boolean; reason?: string } {
  if (
    opts.sensitivity === "guardian_only" ||
    opts.sensitivity === "high"
  ) {
    if (!opts.recipientIsGuardian) {
      return {
        allowed: false,
        reason:
          "Sensitive student data can only be sent to verified guardian/parent email addresses",
      };
    }
    if (!opts.recipientEmailVerified) {
      return {
        allowed: false,
        reason:
          "Recipient email must be verified before receiving sensitive student data",
      };
    }
  }

  return { allowed: true };
}

/**
 * Determine whether an outbound failure is retryable.
 */
export function isRetryableError(error: {
  statusCode?: number;
  code?: string;
  message?: string;
}): boolean {
  if (error.statusCode === 429) return true;
  if (error.statusCode && error.statusCode >= 500) return true;

  const code = error.code?.toLowerCase() ?? "";
  if (
    code.includes("timeout") ||
    code.includes("econnreset") ||
    code.includes("econnrefused") ||
    code.includes("enetunreach")
  ) {
    return true;
  }

  const msg = error.message?.toLowerCase() ?? "";
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnreset")
  ) {
    return true;
  }

  return false;
}

/**
 * Compute exponential backoff delay with jitter for retry scheduling.
 */
export function computeBackoffMs(attempt: number): number {
  const baseMs = Math.min(2 ** Math.max(0, attempt) * 60_000, 24 * 60 * 60_000);
  const jitter = Math.random() * 0.3 * baseMs;
  return Math.round(baseMs + jitter);
}
