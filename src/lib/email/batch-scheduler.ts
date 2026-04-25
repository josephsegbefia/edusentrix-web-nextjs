import "server-only";

import { EmailBatch, type IEmailBatch } from "@/models/EmailBatch";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { EmailMessage } from "@/models/EmailMessage";
import { lookupTemplateRegistry } from "./registry";
import {
  resolveSenderEmail,
  buildSchoolSenderName,
} from "./providers/brevo-provider";
import { resolveSecureContentMode } from "./sensitivity";
import { buildSchoolReplyAlias, buildPlatformReplyAlias, generateRoutingToken } from "./routing";
import { findOrCreateThread, updateThreadAfterMessage } from "./threading";
import { checkHardSuppression } from "./suppressions";
import type { EmailThreadType } from "@/models/EmailThread";
import { renderGenericBrandedEmail, stripHtml } from "./branded-template";

export interface BatchRecipient {
  email: string;
  name?: string;
  userId?: string;
  role?: string;
}

export interface CreateBatchInput {
  schoolId?: string | null;
  schoolName?: string | null;
  schoolLogo?: string | null;
  kind: "bulk" | "digest" | "scheduled_reminder";
  createdBy: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  templateKey: string;
  recipients: BatchRecipient[];
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface CreateBatchResult {
  batchId: string;
  recipientCount: number;
  suppressedCount: number;
  jobsCreated: number;
}

/**
 * Create a batch of outbound emails.
 * Persists one EmailMessage + one EmailDispatchJob per recipient,
 * linked to a single EmailBatch for tracking.
 *
 * Transactional emails bypass this — use `sendTrackedBrevoEmail` directly.
 */
export async function createEmailBatch(
  input: CreateBatchInput,
): Promise<CreateBatchResult> {
  const registry = lookupTemplateRegistry(input.templateKey);
  if (!registry) {
    throw new Error(`Unknown template key: ${input.templateKey}`);
  }
  const htmlContent = renderGenericBrandedEmail({
    subject: input.subject,
    htmlContent: input.htmlContent,
    brand:
      registry.brand === "school"
        ? { name: input.schoolName, logoUrl: input.schoolLogo }
        : undefined,
    tone: registry.senderFamily === "billing" ? "billing" : "default",
  });
  const textContent = input.textContent || stripHtml(htmlContent);

  const batch = await EmailBatch.create({
    schoolId: input.schoolId || null,
    mailboxScope: registry.mailboxScope,
    kind: input.kind,
    createdBy: input.createdBy,
    subject: input.subject,
    templateKey: input.templateKey,
    recipientCount: input.recipients.length,
    sentCount: 0,
    failedCount: 0,
    status: "queued",
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
  });

  const batchId = String(batch._id);
  let suppressedCount = 0;
  let jobsCreated = 0;

  const fromEmail = resolveSenderEmail(registry.senderFamily);
  const fromName =
    registry.brand === "school" && input.schoolName
      ? buildSchoolSenderName(input.schoolName, registry.senderFamily)
      : undefined;

  const mailboxKey = resolveMailboxKey(registry, input.schoolId);
  const threadType = resolveThreadType(registry);

  for (const recipient of input.recipients) {
    const suppression = await checkHardSuppression(
      recipient.email,
      input.schoolId,
    );

    if (suppression) {
      suppressedCount++;
      await EmailMessage.create({
        provider: "brevo",
        direction: "outbound",
        mailboxScope: registry.mailboxScope,
        mailboxKey,
        schoolId: input.schoolId || null,
        batchId,
        from: fromEmail,
        to: recipient.email,
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
        skipReason: `Suppressed: ${suppression.reason}`,
        recipientUserId: recipient.userId || null,
        recipientRole: recipient.role || null,
      });
      continue;
    }

    const routingToken = generateRoutingToken();
    const replyAlias =
      registry.mailboxScope === "school" && input.schoolId
        ? buildSchoolReplyAlias(input.schoolId, routingToken)
        : buildPlatformReplyAlias(
            registry.senderFamily === "billing" ? "billing" : "support",
            routingToken,
          );

    const thread = await findOrCreateThread({
      mailboxScope: registry.mailboxScope,
      mailboxKey,
      schoolId: input.schoolId,
      subject: input.subject,
      threadType,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      participantEmail: recipient.email,
      participantName: recipient.name,
      participantRoleHint: recipient.role,
      participantUserId: recipient.userId,
    });

    const message = await EmailMessage.create({
      provider: "brevo",
      direction: "outbound",
      mailboxScope: registry.mailboxScope,
      mailboxKey,
      schoolId: input.schoolId || null,
      threadId: thread._id,
      batchId,
      from: fromEmail,
      fromName: fromName || null,
      to: recipient.email,
      replyTo: replyAlias,
      subject: input.subject,
      htmlBody: htmlContent,
      textBody: textContent || null,
      status: "queued",
      messageClass: registry.messageClass,
      trafficClass: registry.trafficClass,
      priority: registry.priority,
      sensitivity: registry.sensitivity,
      secureContentMode: resolveSecureContentMode(registry.sensitivity),
      templateKey: input.templateKey,
      recipientUserId: recipient.userId || null,
      recipientRole: recipient.role || null,
      replyAlias,
      routingToken,
    });

    await EmailDispatchJob.create({
      kind: "batch_chunk",
      emailMessageId: message._id,
      emailBatchId: batch._id,
      schoolId: input.schoolId || null,
      senderFamily: registry.senderFamily,
      trafficClass: registry.trafficClass,
      priority: registry.priority,
      status: "pending",
      maxAttempts: 5,
      rateScopeKey: input.schoolId
        ? `school:${input.schoolId}`
        : "platform",
    });

    jobsCreated++;
  }

  if (suppressedCount === input.recipients.length) {
    await EmailBatch.findByIdAndUpdate(batch._id, {
      $set: {
        status: "completed",
        failedCount: suppressedCount,
      },
    });
  }

  return {
    batchId,
    recipientCount: input.recipients.length,
    suppressedCount,
    jobsCreated,
  };
}

/**
 * Cancel a pending/queued batch. Marks remaining dispatch jobs as dead-letter.
 */
export async function cancelBatch(batchId: string): Promise<void> {
  await EmailBatch.findByIdAndUpdate(batchId, {
    $set: { status: "cancelled" },
  });

  await EmailDispatchJob.updateMany(
    {
      emailBatchId: batchId,
      status: { $in: ["pending", "failed"] },
    },
    { $set: { status: "dead_letter", lastError: "Batch cancelled" } },
  );
}

/**
 * Update batch counters after a message dispatch. Called from the dispatch worker.
 */
export async function updateBatchCounters(
  batchId: string,
  outcome: "sent" | "failed",
): Promise<void> {
  const incField = outcome === "sent" ? "sentCount" : "failedCount";

  const batch = await EmailBatch.findByIdAndUpdate(
    batchId,
    { $inc: { [incField]: 1 } },
    { new: true },
  );

  if (!batch) return;

  if (batch.sentCount + batch.failedCount >= batch.recipientCount) {
    const status: IEmailBatch["status"] =
      batch.failedCount > 0 && batch.sentCount === 0
        ? "failed"
        : "completed";

    await EmailBatch.findByIdAndUpdate(batchId, {
      $set: { status },
    });
  }
}

function resolveMailboxKey(
  registry: { mailboxScope: string; senderFamily: string },
  schoolId?: string | null,
): string {
  if (registry.mailboxScope === "school" && schoolId) {
    const kind = registry.senderFamily === "billing" ? "billing" : "general";
    return `school:${schoolId}:${kind}`;
  }
  return `platform_${registry.senderFamily === "billing" ? "billing" : "support"}`;
}

function resolveThreadType(registry: {
  messageClass: string;
}): EmailThreadType {
  switch (registry.messageClass) {
    case "billing_transactional":
    case "billing_reminder":
      return "billing";
    case "announcement":
      return "school_ops";
    default:
      return "school_ops";
  }
}
