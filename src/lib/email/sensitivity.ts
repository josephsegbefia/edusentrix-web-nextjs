import "server-only";

import type {
  EmailSensitivity,
  EmailSecureContentMode,
} from "@/models/EmailMessage";

/**
 * Given a sensitivity level, determine the secure content mode to use.
 * This enforces the rule: guardian_only and high sensitivity emails
 * must use summary_plus_link by default.
 */
export function resolveSecureContentMode(
  sensitivity: EmailSensitivity,
  explicitMode?: EmailSecureContentMode | null,
): EmailSecureContentMode {
  if (explicitMode) return explicitMode;

  switch (sensitivity) {
    case "guardian_only":
    case "high":
      return "summary_plus_link";
    case "moderate":
    case "low":
      return "none";
    default:
      return "none";
  }
}

/**
 * Check whether content can be included directly in the email body
 * or must be behind a secure link.
 */
export function shouldRedactBody(
  sensitivity: EmailSensitivity,
  secureContentMode: EmailSecureContentMode,
): boolean {
  if (secureContentMode === "none") return false;
  if (sensitivity === "guardian_only" || sensitivity === "high") return true;
  return secureContentMode !== "none";
}
