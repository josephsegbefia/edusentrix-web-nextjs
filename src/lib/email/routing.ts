import "server-only";
import crypto from "crypto";

const { EMAIL_REPLY_DOMAIN } = process.env;

function getReplyDomain(): string {
  if (!EMAIL_REPLY_DOMAIN)
    throw new Error("EMAIL_REPLY_DOMAIN is not set");
  return EMAIL_REPLY_DOMAIN;
}

/**
 * Generate a cryptographically random routing token for thread-level reply routing.
 * 16 hex chars (8 bytes) keeps `school+s_<id>+t_<token>@…` under RFC 5321’s
 * 64-octet local-part limit so Brevo accepts `replyTo`.
 */
export function generateRoutingToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Build a reply alias for school-scoped email.
 * Format: school+s_<schoolId>+t_<token>@reply.domain
 */
export function buildSchoolReplyAlias(
  schoolId: string,
  routingToken: string,
): string {
  const domain = getReplyDomain();
  return `school+s_${schoolId}+t_${routingToken}@${domain}`;
}

/**
 * Build a reply alias for platform-scoped email.
 * Format: platform+p_<inbox>+t_<token>@reply.domain
 */
export function buildPlatformReplyAlias(
  inboxKey: string,
  routingToken: string,
): string {
  const domain = getReplyDomain();
  return `platform+p_${inboxKey}+t_${routingToken}@${domain}`;
}

/**
 * Build a reply alias for billing-scoped email with an entity hint.
 * Format: billing+s_<schoolId>+i_<entityId>+t_<token>@reply.domain
 */
export function buildBillingReplyAlias(
  schoolId: string,
  entityId: string,
  routingToken: string,
): string {
  const domain = getReplyDomain();
  return `billing+s_${schoolId}+i_${entityId}+t_${routingToken}@${domain}`;
}

export interface ParsedReplyAlias {
  scope: "school" | "platform" | "billing";
  schoolId?: string;
  inboxKey?: string;
  entityId?: string;
  routingToken: string;
}

/** Token was 32 hex (legacy); new sends use 16 hex to satisfy Brevo / RFC 5321. */
const SCHOOL_RE =
  /^school\+s_([a-f0-9]{24})\+t_([a-f0-9]{16,32})@/i;
const PLATFORM_RE =
  /^platform\+p_([a-z0-9_]+)\+t_([a-f0-9]{16,32})@/i;
const BILLING_RE =
  /^billing\+s_([a-f0-9]{24})\+i_([a-f0-9]{24})\+t_([a-f0-9]{16,32})@/i;

/**
 * Parse a reply-to alias address into structured routing components.
 * Returns null if the address doesn't match any known format.
 */
export function parseReplyAlias(address: string): ParsedReplyAlias | null {
  const lower = address.toLowerCase().trim();

  const billingMatch = lower.match(BILLING_RE);
  if (billingMatch) {
    return {
      scope: "billing",
      schoolId: billingMatch[1],
      entityId: billingMatch[2],
      routingToken: billingMatch[3],
    };
  }

  const schoolMatch = lower.match(SCHOOL_RE);
  if (schoolMatch) {
    return {
      scope: "school",
      schoolId: schoolMatch[1],
      routingToken: schoolMatch[2],
    };
  }

  const platformMatch = lower.match(PLATFORM_RE);
  if (platformMatch) {
    return {
      scope: "platform",
      inboxKey: platformMatch[1],
      routingToken: platformMatch[2],
    };
  }

  return null;
}
