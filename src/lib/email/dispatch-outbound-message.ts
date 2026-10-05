import "server-only";

import { RetryAfterError } from "inngest";
import { Types } from "mongoose";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import { EmailMessage } from "@/models/EmailMessage";
import { BackgroundJobError, sanitizeBackgroundErrorMessage } from "@/lib/background/errors";
import { refreshCommunicationStats } from "@/lib/communications/delivery/communicationDeliveryService";
import { updateBatchCounters } from "@/lib/email/batch-scheduler";
import { isRetryableError } from "@/lib/email/policy";
import { checkRateLimit, recordSend } from "@/lib/email/rate-limiter";
import { lookupTemplateRegistry } from "@/lib/email/registry";
import { reconstructDispatchAttachments } from "@/lib/email/reconstruct-dispatch-attachments";
import { checkHardSuppression } from "@/lib/email/suppressions";
import { updateThreadAfterMessage } from "@/lib/email/threading";
import {
  resendSend,
  ResendSendError,
  resolveSenderEmail,
} from "@/lib/email/providers/resend-provider";
import { isSucceededEmailStatus } from "@/lib/email/email-dispatch-keys";

const CLAIMABLE_STATUSES = ["queued", "failed", "deferred"] as const;
const SUCCEEDED_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;
const CLAIM_STALE_MS = 2 * 60 * 1000;

async function syncCommunicationDeliveryFromEmail(args: {
  messageId: unknown;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  failureReason?: string | null;
}) {
  if (args.relatedEntityType !== "Communication" || !args.relatedEntityId) return;
  const updated = await CommunicationDelivery.findOneAndUpdate(
    {
      outputEntityType: "EmailMessage",
      outputEntityId: args.messageId,
    },
    {
      $set: {
        status: args.status,
        sentAt: args.status === "sent" ? new Date() : null,
        providerMessageId: args.providerMessageId || null,
        failureReason: args.failureReason || null,
      },
    },
    { new: true }
  ).select("communicationId");

  if (updated?.communicationId) {
    await refreshCommunicationStats(updated.communicationId);
  }
}

function throwProviderFailure(error: unknown): never {
  if (error instanceof ResendSendError) {
    const retryable = isRetryableError({
      statusCode: error.statusCode,
      message: error.message,
    });
    if (retryable && error.retryAfterMs != null) {
      throw new RetryAfterError(error.message, error.retryAfterMs);
    }
    if (retryable) {
      throw new BackgroundJobError({
        message: error.message,
        category: "RETRYABLE",
        code: "RESEND_TRANSIENT",
      });
    }
    throw new BackgroundJobError({
      message: error.message,
      category: "PERMANENT",
      code: "RESEND_PERMANENT",
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  const retryable = isRetryableError({ message });
  throw new BackgroundJobError({
    message,
    category: retryable ? "RETRYABLE" : "PERMANENT",
    code: retryable ? "EMAIL_TRANSIENT" : "EMAIL_PERMANENT",
  });
}

export async function markEmailMessageDispatchFailed(input: {
  emailMessageId: string | Types.ObjectId;
  error: unknown;
}): Promise<void> {
  const reason = sanitizeBackgroundErrorMessage(input.error);
  const failedMessage = await EmailMessage.findOneAndUpdate(
    {
      _id: input.emailMessageId,
      status: { $nin: [...SUCCEEDED_STATUSES] },
    },
    {
      $set: {
        status: "failed",
        failureReason: reason,
        dispatchClaimedAt: null,
      },
    },
    { new: true }
  );
  if (!failedMessage) return;

  await syncCommunicationDeliveryFromEmail({
    messageId: failedMessage._id,
    relatedEntityType: failedMessage.relatedEntityType,
    relatedEntityId: failedMessage.relatedEntityId,
    status: "failed",
    failureReason: reason,
  });
  if (failedMessage.batchId) {
    await updateBatchCounters(String(failedMessage.batchId), "failed");
  }
}

export async function dispatchOutboundEmailMessage(input: {
  emailMessageId: string;
  expectedSchoolId?: string | null;
}): Promise<{ outcome: "sent" | "already_sent" | "noop"; providerMessageId?: string }> {
  const message = await EmailMessage.findById(input.emailMessageId);
  if (!message) {
    throw new BackgroundJobError({
      message: "EmailMessage not found",
      category: "PERMANENT",
      code: "EMAIL_MESSAGE_NOT_FOUND",
    });
  }

  const messageSchoolId = message.schoolId ? String(message.schoolId) : null;
  const expectedSchoolId = input.expectedSchoolId || null;
  if (messageSchoolId !== expectedSchoolId) {
    throw new BackgroundJobError({
      message: "EmailMessage tenant does not match BackgroundJob",
      category: "PERMANENT",
      code: "TENANT_MISMATCH",
    });
  }

  if (isSucceededEmailStatus(message.status)) {
    return { outcome: "already_sent", providerMessageId: message.providerMessageId || undefined };
  }

  if (message.status === "dead_letter") {
    return { outcome: "noop" };
  }

  if (message.skipReason) {
    const error = new BackgroundJobError({
      message: message.skipReason,
      category: "PERMANENT",
      code: "EMAIL_SUPPRESSED",
    });
    await markEmailMessageDispatchFailed({ emailMessageId: message._id, error });
    throw error;
  }

  const suppression = await checkHardSuppression(
    message.to,
    message.schoolId ? String(message.schoolId) : null
  );
  if (suppression) {
    const error = new BackgroundJobError({
      message: `Suppressed: ${suppression.reason}`,
      category: "PERMANENT",
      code: "EMAIL_SUPPRESSED",
    });
    await markEmailMessageDispatchFailed({ emailMessageId: message._id, error });
    throw error;
  }

  const staleCutoff = new Date(Date.now() - CLAIM_STALE_MS);
  const claimed = await EmailMessage.findOneAndUpdate(
    {
      _id: message._id,
      status: { $in: [...CLAIMABLE_STATUSES] },
      $or: [
        { dispatchClaimedAt: null },
        { dispatchClaimedAt: { $exists: false } },
        { dispatchClaimedAt: { $lte: staleCutoff } },
      ],
    },
    {
      $set: { status: "queued", dispatchClaimedAt: new Date() },
      $unset: { failureReason: 1 },
    },
    { new: true }
  );

  if (!claimed) {
    const fresh = await EmailMessage.findById(message._id);
    if (fresh && isSucceededEmailStatus(fresh.status)) {
      return { outcome: "already_sent", providerMessageId: fresh.providerMessageId || undefined };
    }
    if (fresh?.status === "dead_letter") {
      return { outcome: "noop" };
    }
    throw new BackgroundJobError({
      message: "Email message is already being dispatched",
      category: "RETRYABLE",
      code: "EMAIL_CLAIM_CONFLICT",
    });
  }

  const registry = claimed.templateKey
    ? lookupTemplateRegistry(claimed.templateKey)
    : null;

  const rateCheck = await checkRateLimit({
    schoolId: claimed.schoolId ? String(claimed.schoolId) : null,
    trafficClass:
      (claimed.trafficClass as "transactional" | "manual" | "bulk" | "digest") ||
      "transactional",
  });

  if (!rateCheck.allowed) {
    await EmailMessage.updateOne(
      { _id: claimed._id },
      { $set: { status: "deferred", dispatchClaimedAt: null } }
    );
    if (rateCheck.retryAfterMs != null) {
      throw new RetryAfterError(
        `Rate limited: ${rateCheck.scope || "unknown"}`,
        rateCheck.retryAfterMs
      );
    }
    throw new BackgroundJobError({
      message: `Rate limited: ${rateCheck.scope || "unknown"}`,
      category: "RETRYABLE",
      code: "EMAIL_RATE_LIMITED",
    });
  }

  const attachments = await reconstructDispatchAttachments(claimed);

  try {
    const result = await resendSend({
      to: claimed.to,
      subject: claimed.subject,
      htmlContent: claimed.htmlBody || "",
      textContent: claimed.textBody || undefined,
      attachments,
      fromEmail: claimed.from || resolveSenderEmail(registry?.senderFamily || "hello"),
      fromName: claimed.fromName || undefined,
      replyTo: claimed.replyTo || undefined,
      tags: [
        claimed.templateKey || "unknown",
        claimed.trafficClass,
        ...(claimed.schoolId ? [`school:${String(claimed.schoolId)}`] : []),
      ],
      idempotencyKey: `email-${String(claimed._id)}`,
    });

    await recordSend({
      schoolId: claimed.schoolId ? String(claimed.schoolId) : null,
      trafficClass:
        (claimed.trafficClass as "transactional" | "manual" | "bulk" | "digest") ||
        "transactional",
    });

    await EmailMessage.findByIdAndUpdate(claimed._id, {
      $set: {
        status: "sent",
        providerMessageId: result.providerMessageId || null,
        messageIdHeader: result.providerMessageId || null,
        sentAt: new Date(),
        dispatchClaimedAt: null,
        failureReason: null,
      },
    });

    if (claimed.threadId) {
      await updateThreadAfterMessage(String(claimed.threadId), "outbound");
    }

    await syncCommunicationDeliveryFromEmail({
      messageId: claimed._id,
      relatedEntityType: claimed.relatedEntityType,
      relatedEntityId: claimed.relatedEntityId,
      status: "sent",
      providerMessageId: result.providerMessageId || null,
    });

    if (claimed.batchId) {
      await updateBatchCounters(String(claimed.batchId), "sent");
    }

    return { outcome: "sent", providerMessageId: result.providerMessageId };
  } catch (error) {
    await EmailMessage.updateOne(
      { _id: claimed._id, status: "queued" },
      { $set: { dispatchClaimedAt: null } }
    );
    try {
      throwProviderFailure(error);
    } catch (classified) {
      if (
        classified instanceof BackgroundJobError &&
        classified.category === "PERMANENT"
      ) {
        await markEmailMessageDispatchFailed({
          emailMessageId: claimed._id,
          error: classified,
        });
      }
      throw classified;
    }
  }
}
