import "server-only";

import type { TemplateRegistryEntry } from "./registry";
import {
  buildBillingReplyAlias,
  buildPlatformReplyAlias,
  buildSchoolReplyAlias,
} from "./routing";
import { resolveSenderEmail } from "./providers/resend-provider";
import type { PlatformMailboxId } from "./platform-mailboxes";

const DIRECT_PLATFORM_REPLY_TEMPLATE_KEYS = new Set([
  "PLATFORM_PROPOSAL",
  "PLATFORM_PROPOSAL_FOLLOW_UP",
  "PLATFORM_HELLO_MANUAL_EMAIL",
  "PLATFORM_MANUAL_EMAIL",
  "PLATFORM_BILLING_MANUAL_EMAIL",
  "PLATFORM_ADMIN_REPLY_NOTIFICATION",
  "CONTACT_FORM_SUBMISSION",
]);

/**
 * School → parent/stakeholder mail uses routed reply aliases (ingested via support@ IMAP).
 * Platform operator mail uses real hello/support/billing addresses.
 */
export function usesRoutedReplyTo(
  templateKey: string,
  registry: TemplateRegistryEntry,
): boolean {
  if (registry.mailboxScope === "school") return true;
  if (DIRECT_PLATFORM_REPLY_TEMPLATE_KEYS.has(templateKey)) return false;
  return false;
}

export function resolveOutboundReplyTo(args: {
  templateKey: string;
  registry: TemplateRegistryEntry;
  schoolId?: string | null;
  entityId?: string | null;
  routingToken: string;
  senderFamily: PlatformMailboxId;
}): { replyTo: string; replyAlias: string | null } {
  if (usesRoutedReplyTo(args.templateKey, args.registry)) {
    if (
      args.registry.senderFamily === "billing" &&
      args.schoolId &&
      args.entityId
    ) {
      const alias = buildBillingReplyAlias(
        args.schoolId,
        args.entityId,
        args.routingToken,
      );
      return { replyTo: alias, replyAlias: alias };
    }
    if (args.registry.mailboxScope === "school" && args.schoolId) {
      const alias = buildSchoolReplyAlias(args.schoolId, args.routingToken);
      return { replyTo: alias, replyAlias: alias };
    }
    const alias = buildPlatformReplyAlias(
      args.senderFamily,
      args.routingToken,
    );
    return { replyTo: alias, replyAlias: alias };
  }

  const direct = resolveSenderEmail(args.senderFamily);
  return { replyTo: direct, replyAlias: null };
}
