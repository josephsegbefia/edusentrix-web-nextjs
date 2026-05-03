import type { SchoolInternalTestSnapshot } from "./load-internal-test-context";

export type ExternalNotificationChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "push"
  | "parent_notification";

/**
 * Outbound / external delivery suppression per channel (spec §17.2).
 * Parent-facing WhatsApp is suppressed when WhatsApp or parent notifications are off.
 */
export function shouldSuppressNotification(
  snapshot: SchoolInternalTestSnapshot | null,
  channel: ExternalNotificationChannel
): boolean {
  if (!snapshot?.school.isInternalTestSchool || !snapshot.config) return false;
  const c = snapshot.config;
  switch (channel) {
    case "email":
      return Boolean(c.suppressEmailInvitations);
    case "sms":
      return Boolean(c.suppressSms);
    case "whatsapp":
      return Boolean(c.suppressWhatsapp);
    case "push":
      return Boolean(c.suppressPushNotifications);
    case "parent_notification":
      return Boolean(c.suppressParentNotifications);
    default:
      return false;
  }
}

/** Guardian-facing WhatsApp (attendance, fee nudges): treat as parent channel OR whatsapp. */
export function shouldSuppressParentFacingWhatsApp(snapshot: SchoolInternalTestSnapshot | null): boolean {
  if (!snapshot?.school.isInternalTestSchool || !snapshot.config) return false;
  const c = snapshot.config;
  return Boolean(c.suppressWhatsapp || c.suppressParentNotifications);
}
