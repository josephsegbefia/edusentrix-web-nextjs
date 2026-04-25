import "server-only";
import { Types } from "mongoose";

import { EmailMessage, type IEmailMessage } from "@/models/EmailMessage";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { School } from "@/models/School";
import { lookupTemplateRegistry } from "../registry";
import {
  brevoSend,
  resolveSenderEmail,
  buildSchoolSenderName,
} from "../providers/brevo-provider";
import { findOrCreateThread, updateThreadAfterMessage } from "../threading";
import {
  buildSchoolReplyAlias,
  buildPlatformReplyAlias,
  generateRoutingToken,
} from "../routing";
import { checkHardSuppression, checkCategoryOptOut } from "../suppressions";
import { resolveSecureContentMode } from "../sensitivity";
import { checkRateLimit, recordSend } from "../rate-limiter";
import type { EmailThreadType } from "@/models/EmailThread";
import { renderGenericBrandedEmail, stripHtml } from "../branded-template";

export interface SendBrevoEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  templateKey: string;

  schoolId?: string | null;
  schoolName?: string | null;
  schoolLogo?: string | null;
  attachments?: Array<{
    name: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string | null;
    contentBase64?: string;
    url?: string;
  }>;

  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  threadType?: EmailThreadType;

  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;

  recipientUserId?: string | null;
  recipientRole?: string | null;
  recipientEmailVerified?: boolean;

  batchId?: string | null;

  /** If true, persist message as queued and create a dispatch job instead of sending immediately. */
  async?: boolean;
}

export interface SendBrevoEmailResult {
  messageId: string;
  providerMessageId?: string;
  threadId?: string;
  status: IEmailMessage["status"];
}

/**
 * High-level Brevo email send: persists audit record, resolves thread,
 * checks suppressions, and sends (or queues) via the Brevo provider.
 */
export async function sendTrackedBrevoEmail(
  input: SendBrevoEmailInput,
): Promise<SendBrevoEmailResult> {
  const registry = lookupTemplateRegistry(input.templateKey);
  if (!registry) {
    throw new Error(`Unknown template key: ${input.templateKey}`);
  }
  const branding = await resolveSchoolBranding({
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    schoolLogo: input.schoolLogo,
    useSchoolBrand: registry.brand === "school",
  });
  const attachmentMetadata = normalizeAttachmentMetadata(input.attachments);
  const htmlContent = renderGenericBrandedEmail({
    subject: input.subject,
    htmlContent: input.htmlContent,
    brand: branding,
    tone: registry.senderFamily === "billing" ? "billing" : "default",
  });
  const textContent = input.textContent || stripHtml(htmlContent);

  const suppression = await checkHardSuppression(
    input.to,
    input.schoolId,
  );
  if (suppression) {
    const message = await EmailMessage.create({
      provider: "brevo",
      direction: "outbound",
      mailboxScope: registry.mailboxScope,
      mailboxKey: resolveMailboxKey(registry, input.schoolId),
      schoolId: input.schoolId || null,
      from: resolveSenderEmail(registry.senderFamily),
      to: input.to,
      subject: input.subject,
      htmlBody: htmlContent,
      textBody: textContent || null,
      status: "failed",
      messageClass: registry.messageClass,
      trafficClass: registry.trafficClass,
      priority: registry.priority,
      sensitivity: registry.sensitivity,
      secureContentMode: resolveSecureContentMode(registry.sensitivity),
      templateKey: input.templateKey,
      relatedEntityType: input.relatedEntityType || null,
      relatedEntityId: input.relatedEntityId || null,
      actorId: input.actorId || null,
      actorName: input.actorName || null,
      actorRole: input.actorRole || null,
      recipientUserId: input.recipientUserId || null,
      recipientRole: input.recipientRole || null,
      recipientEmailVerified: input.recipientEmailVerified ?? null,
      skipReason: `Suppressed: ${suppression.reason}`,
      attachments: attachmentMetadata,
      batchId: input.batchId || null,
    });

    return {
      messageId: String(message._id),
      status: "failed",
    };
  }

  if (registry.preferenceClass !== "transactional") {
    const categoryKey = resolveCategoryKey(registry.messageClass);
    if (categoryKey) {
      const optedOut = await checkCategoryOptOut(
        input.to,
        categoryKey,
        input.schoolId,
      );
      if (optedOut) {
        const message = await EmailMessage.create({
          provider: "brevo",
          direction: "outbound",
          mailboxScope: registry.mailboxScope,
          mailboxKey: resolveMailboxKey(registry, input.schoolId),
          schoolId: input.schoolId || null,
          from: resolveSenderEmail(registry.senderFamily),
          to: input.to,
          subject: input.subject,
          htmlBody: htmlContent,
          textBody: textContent || null,
          status: "failed",
          messageClass: registry.messageClass,
          trafficClass: registry.trafficClass,
          priority: registry.priority,
          sensitivity: registry.sensitivity,
          secureContentMode: resolveSecureContentMode(registry.sensitivity),
          templateKey: input.templateKey,
          skipReason: `Category opt-out: ${categoryKey}`,
          attachments: attachmentMetadata,
          batchId: input.batchId || null,
        });

        return {
          messageId: String(message._id),
          status: "failed",
        };
      }
    }
  }

  const thread = await findOrCreateThread({
    mailboxScope: registry.mailboxScope,
    mailboxKey: resolveMailboxKey(registry, input.schoolId),
    schoolId: input.schoolId,
    subject: input.subject,
    threadType: input.threadType || resolveThreadType(registry),
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    participantEmail: input.to,
    participantName: input.toName,
    participantRoleHint: input.recipientRole,
    participantUserId: input.recipientUserId,
  });

  const routingToken = thread.routingToken || generateRoutingToken();

  const replyAlias =
    registry.mailboxScope === "school" && input.schoolId
      ? buildSchoolReplyAlias(input.schoolId, routingToken)
      : buildPlatformReplyAlias(
          registry.senderFamily === "billing" ? "billing" : "support",
          routingToken,
        );

  const fromEmail = resolveSenderEmail(registry.senderFamily);
  const fromName =
    registry.brand === "school" && input.schoolName
      ? buildSchoolSenderName(input.schoolName, registry.senderFamily)
      : undefined;

  const message = await EmailMessage.create({
    provider: "brevo",
    direction: "outbound",
    mailboxScope: registry.mailboxScope,
    mailboxKey: resolveMailboxKey(registry, input.schoolId),
    schoolId: input.schoolId || null,
    threadId: thread._id,
    batchId: input.batchId || null,
    from: fromEmail,
    fromName: fromName || null,
    to: input.to,
    replyTo: replyAlias,
    subject: input.subject,
    htmlBody: htmlContent,
    textBody: textContent || null,
    status: input.async ? "queued" : "queued",
    messageClass: registry.messageClass,
    trafficClass: registry.trafficClass,
    priority: registry.priority,
    sensitivity: registry.sensitivity,
    secureContentMode: resolveSecureContentMode(registry.sensitivity),
    templateKey: input.templateKey,
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
    actorId: input.actorId || null,
    actorName: input.actorName || null,
    actorRole: input.actorRole || null,
    recipientUserId: input.recipientUserId || null,
    recipientRole: input.recipientRole || null,
    recipientEmailVerified: input.recipientEmailVerified ?? null,
    attachments: attachmentMetadata,
    replyAlias,
    routingToken,
  });

  if (input.async) {
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: message._id,
      schoolId: input.schoolId || null,
      senderFamily: registry.senderFamily,
      trafficClass: registry.trafficClass,
      priority: registry.priority,
      status: "pending",
      maxAttempts: 10,
    });

    return {
      messageId: String(message._id),
      threadId: String(thread._id),
      status: "queued",
    };
  }

  const rateCheck = await checkRateLimit({
    schoolId: input.schoolId,
    trafficClass: registry.trafficClass as "transactional" | "manual" | "bulk" | "digest",
  });

  if (!rateCheck.allowed) {
    await EmailDispatchJob.create({
      kind: "outbound_single",
      emailMessageId: message._id,
      schoolId: input.schoolId || null,
      senderFamily: registry.senderFamily,
      trafficClass: registry.trafficClass,
      priority: registry.priority,
      status: "pending",
      maxAttempts: 10,
      nextRunAt: new Date(Date.now() + (rateCheck.retryAfterMs || 60_000)),
    });

    return {
      messageId: String(message._id),
      threadId: String(thread._id),
      status: "queued",
    };
  }

  try {
    const result = await brevoSend({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      htmlContent,
      textContent,
      attachments: normalizeProviderAttachments(input.attachments),
      fromEmail,
      fromName,
      replyTo: replyAlias,
      tags: [
        input.templateKey,
        registry.trafficClass,
        registry.senderFamily,
        ...(input.schoolId ? [`school:${input.schoolId}`] : []),
      ],
    });

    await recordSend({
      schoolId: input.schoolId,
      trafficClass: registry.trafficClass as "transactional" | "manual" | "bulk" | "digest",
    });

    await EmailMessage.findByIdAndUpdate(message._id, {
      $set: {
        status: "sent",
        providerMessageId: result.providerMessageId || null,
        sentAt: new Date(),
      },
    });

    await updateThreadAfterMessage(String(thread._id), "outbound");

    return {
      messageId: String(message._id),
      providerMessageId: result.providerMessageId,
      threadId: String(thread._id),
      status: "sent",
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : String(error);
    await EmailMessage.findByIdAndUpdate(message._id, {
      $set: { status: "failed", failureReason: msg },
    });

    throw error;
  }
}

async function resolveSchoolBranding(args: {
  schoolId?: string | null;
  schoolName?: string | null;
  schoolLogo?: string | null;
  useSchoolBrand: boolean;
}) {
  if (!args.useSchoolBrand) return undefined;
  if (args.schoolName && args.schoolLogo) {
    return { name: args.schoolName, logoUrl: args.schoolLogo };
  }
  if (!args.schoolId) {
    return args.schoolName ? { name: args.schoolName, logoUrl: args.schoolLogo } : undefined;
  }

  const school = await School.findById(args.schoolId)
    .select("name logo")
    .lean<{ name?: string | null; logo?: string | null } | null>();

  return {
    name: args.schoolName || school?.name || undefined,
    logoUrl: args.schoolLogo || school?.logo || undefined,
  };
}

function normalizeAttachmentMetadata(
  attachments: SendBrevoEmailInput["attachments"],
) {
  return (attachments || []).map((attachment) => ({
    name: attachment.name,
    mimeType: attachment.mimeType || "application/octet-stream",
    sizeBytes: attachment.sizeBytes ?? null,
    storageKey: attachment.storageKey || attachment.url || null,
    generated: false,
  }));
}

function normalizeProviderAttachments(
  attachments: SendBrevoEmailInput["attachments"],
) {
  return (attachments || []).map((attachment) => ({
    name: attachment.name,
    contentBase64: attachment.contentBase64,
    url: attachment.url,
  }));
}

function resolveMailboxKey(
  registry: { mailboxScope: string; senderFamily: string },
  schoolId?: string | null,
): string {
  if (registry.mailboxScope === "school" && schoolId) {
    const kind =
      registry.senderFamily === "billing" ? "billing" : "general";
    return `school:${schoolId}:${kind}`;
  }
  return `platform_${registry.senderFamily === "billing" ? "billing" : "support"}`;
}

function resolveThreadType(registry: {
  messageClass: string;
}): EmailThreadType {
  switch (registry.messageClass) {
    case "invitation":
      return "invitation";
    case "billing_transactional":
    case "billing_reminder":
      return "billing";
    case "support":
      return "support";
    case "manual":
      return "manual";
    default:
      return "school_ops";
  }
}

function resolveCategoryKey(messageClass: string): string | null {
  switch (messageClass) {
    case "attendance":
      return "attendance";
    case "academic":
      return "academics";
    case "announcement":
      return "announcements";
    case "billing_reminder":
      return "billingReminders";
    case "manual":
      return "manualMessages";
    default:
      return null;
  }
}
