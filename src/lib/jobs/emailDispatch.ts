import "server-only";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailDispatchJob, type IEmailDispatchJob } from "@/models/EmailDispatchJob";
import { EmailMessage } from "@/models/EmailMessage";
import { EmailThread } from "@/models/EmailThread";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import {
  brevoSend,
  resolveSenderEmail,
  buildSchoolSenderName,
} from "@/lib/email/providers/brevo-provider";
import { refreshCommunicationStats } from "@/lib/communications/delivery/communicationDeliveryService";
import { updateThreadAfterMessage } from "@/lib/email/threading";
import { lookupTemplateRegistry } from "@/lib/email/registry";
import { isRetryableError, computeBackoffMs } from "@/lib/email/policy";
import { checkRateLimit, recordSend } from "@/lib/email/rate-limiter";
import { updateBatchCounters } from "@/lib/email/batch-scheduler";

const MAX_BATCH_SIZE = 50;
const STALE_MINUTES = 15;

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
    { new: true },
  ).select("communicationId");

  if (updated?.communicationId) {
    await refreshCommunicationStats(updated.communicationId);
  }
}

/**
 * Atomically claim one pending dispatch job.
 * Priority order: critical > high > normal > low, then oldest first.
 */
async function claimOneJob(): Promise<IEmailDispatchJob | null> {
  const now = new Date();
  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  return EmailDispatchJob.findOneAndUpdate(
    {
      $or: [
        { status: "pending", $or: [{ nextRunAt: null }, { nextRunAt: { $lte: now } }] },
        { status: "failed", nextRunAt: { $lte: now } },
        { status: "running", lockedAt: { $lte: staleCutoff } },
      ],
    },
    {
      $set: { status: "running", lockedAt: now, lastError: null },
      $inc: { attempts: 1 },
    },
    {
      new: true,
      sort: { priority: 1, createdAt: 1 },
    },
  );
}

async function processOutboundSingle(job: IEmailDispatchJob): Promise<void> {
  if (!job.emailMessageId) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "No emailMessageId" },
    });
    return;
  }

  const message = await EmailMessage.findById(job.emailMessageId);
  if (!message) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "EmailMessage not found" },
    });
    return;
  }

  if (message.status === "sent" || message.status === "delivered") {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: null },
    });
    return;
  }

  const registry = message.templateKey
    ? lookupTemplateRegistry(message.templateKey)
    : null;

  const rateCheck = await checkRateLimit({
    schoolId: message.schoolId ? String(message.schoolId) : null,
    trafficClass: (message.trafficClass as "transactional" | "manual" | "bulk" | "digest") || "transactional",
  });

  if (!rateCheck.allowed) {
    const nextRunAt = new Date(Date.now() + (rateCheck.retryAfterMs || 60_000));
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "pending",
        lastError: `Rate limited: ${rateCheck.scope}`,
        nextRunAt,
        lockedAt: null,
      },
      $inc: { attempts: -1 },
    });
    return;
  }

  const result = await brevoSend({
    to: message.to,
    subject: message.subject,
    htmlContent: message.htmlBody || "",
    textContent: message.textBody || undefined,
    fromEmail: message.from || resolveSenderEmail(registry?.senderFamily || "hello"),
    fromName: message.fromName || undefined,
    replyTo: message.replyTo || undefined,
    tags: [
      message.templateKey || "unknown",
      message.trafficClass,
      ...(message.schoolId ? [`school:${String(message.schoolId)}`] : []),
    ],
  });

  await recordSend({
    schoolId: message.schoolId ? String(message.schoolId) : null,
    trafficClass: (message.trafficClass as "transactional" | "manual" | "bulk" | "digest") || "transactional",
  });

  await EmailMessage.findByIdAndUpdate(message._id, {
    $set: {
      status: "sent",
      providerMessageId: result.providerMessageId || null,
      sentAt: new Date(),
    },
  });

  if (message.threadId) {
    await updateThreadAfterMessage(String(message.threadId), "outbound");
  }

  await syncCommunicationDeliveryFromEmail({
    messageId: message._id,
    relatedEntityType: message.relatedEntityType,
    relatedEntityId: message.relatedEntityId,
    status: "sent",
    providerMessageId: result.providerMessageId || null,
  });

  if (job.emailBatchId) {
    await updateBatchCounters(String(job.emailBatchId), "sent");
  }

  await EmailDispatchJob.findByIdAndUpdate(job._id, {
    $set: { status: "done", lastError: null },
  });
}

async function processInboundRoute(job: IEmailDispatchJob): Promise<void> {
  if (!job.emailMessageId) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "No emailMessageId" },
    });
    return;
  }

  const message = await EmailMessage.findById(job.emailMessageId);
  if (!message) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: "EmailMessage not found" },
    });
    return;
  }

  if (message.threadId) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: { status: "done", lastError: null },
    });
    return;
  }

  const routingToken = message.routingToken;
  const thread = routingToken
    ? await EmailThread.findOne({ routingToken }).select("_id").lean()
    : null;

  if (!thread) {
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "failed",
        lastError: routingToken
          ? `No thread found for routing token ${routingToken}`
          : "Inbound message has no routing token",
        nextRunAt: new Date(Date.now() + 5 * 60 * 1000),
        lockedAt: null,
      },
    });
    return;
  }

  await EmailMessage.findByIdAndUpdate(message._id, {
    $set: {
      threadId: thread._id,
      status: "received",
    },
  });
  await updateThreadAfterMessage(String(thread._id), "inbound");
  await EmailDispatchJob.findByIdAndUpdate(job._id, {
    $set: { status: "done", lastError: null, lockedAt: null },
  });
}

async function processJob(job: IEmailDispatchJob): Promise<void> {
  try {
    switch (job.kind) {
      case "outbound_single":
      case "batch_chunk":
        await processOutboundSingle(job);
        break;
      case "inbound_route":
        await processInboundRoute(job);
        break;
      case "imap_recovery": {
        const { runImapRecoverySync } = await import("@/lib/jobs/imapRecoverySync");
        await runImapRecoverySync();
        await EmailDispatchJob.findByIdAndUpdate(job._id, {
          $set: { status: "done", lastError: null },
        });
        break;
      }
      default:
        await EmailDispatchJob.findByIdAndUpdate(job._id, {
          $set: { status: "done", lastError: `Unsupported kind: ${job.kind}` },
        });
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const attempts = job.attempts ?? 1;
    const retryable = isRetryableError({ message: msg });
    const maxReached = attempts >= job.maxAttempts;

    if (!retryable || maxReached) {
      await EmailDispatchJob.findByIdAndUpdate(job._id, {
        $set: {
          status: maxReached ? "dead_letter" : "done",
          lastError: msg,
          lockedAt: null,
        },
      });

      if (job.emailMessageId) {
        const failedMessage = await EmailMessage.findByIdAndUpdate(job.emailMessageId, {
          $set: { status: "failed", failureReason: msg },
        }, { new: true });
        if (failedMessage) {
          await syncCommunicationDeliveryFromEmail({
            messageId: failedMessage._id,
            relatedEntityType: failedMessage.relatedEntityType,
            relatedEntityId: failedMessage.relatedEntityId,
            status: "failed",
            failureReason: msg,
          });
        }
      }

      if (job.emailBatchId) {
        await updateBatchCounters(String(job.emailBatchId), "failed");
      }
      return;
    }

    const nextRunAt = new Date(Date.now() + computeBackoffMs(attempts));
    await EmailDispatchJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "failed",
        lastError: msg,
        nextRunAt,
        lockedAt: null,
      },
    });
  }
}

export interface EmailDispatchRunResult {
  processed: number;
  failed: number;
  deadLettered: number;
}

/**
 * Process up to `MAX_BATCH_SIZE` pending email dispatch jobs.
 * Designed to be called from a cron endpoint.
 */
export async function runEmailDispatchJob(): Promise<EmailDispatchRunResult> {
  await connectToDatabase();

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (let i = 0; i < MAX_BATCH_SIZE; i++) {
    const job = await claimOneJob();
    if (!job) break;

    try {
      await processJob(job);

      const updated = await EmailDispatchJob.findById(job._id).select("status").lean();
      if (updated?.status === "dead_letter") {
        deadLettered++;
      } else if (updated?.status === "failed") {
        failed++;
      }

      processed++;
    } catch {
      failed++;
      processed++;
    }
  }

  return { processed, failed, deadLettered };
}
