import "server-only";

import { Types } from "mongoose";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { refreshCommunicationStats } from "@/lib/communications/delivery/communicationDeliveryService";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { sendSmsMessage } from "@/lib/notifications/sms";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { Communication } from "@/models/Communication";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";
import { Notification, type NotificationPriority, type NotificationType } from "@/models/Notification";
import { SmsMessage } from "@/models/SmsMessage";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";

function notificationTypeFor(type: string): NotificationType {
  if (type === "fee_reminder") return "fee";
  if (type === "attendance_alert") return "attendance";
  if (type === "direct_message") return "message";
  if (type === "system_alert") return "system";
  if (type === "emergency_alert") return "announcement";
  return "announcement";
}

function notificationPriorityFor(priority: string): NotificationPriority {
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "low") return "low";
  return "normal";
}

export async function executeCommunicationOutbox(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const outboxJobId =
    typeof tracked.job.input?.communicationOutboxJobId === "string"
      ? tracked.job.input.communicationOutboxJobId
      : null;
  const deliveryId =
    typeof tracked.job.input?.deliveryId === "string" ? tracked.job.input.deliveryId : null;

  if (!outboxJobId || !Types.ObjectId.isValid(outboxJobId)) {
    throw new BackgroundJobError({
      message: "communicationOutboxJobId is required",
      category: "PREREQUISITE_FAILED",
    });
  }

  const claimed = await CommunicationOutboxJob.findOneAndUpdate(
    {
      _id: outboxJobId,
      schoolId: tracked.job.schoolId,
      status: { $in: ["pending", "running", "failed"] },
    },
    { $set: { status: "running", lockedAt: new Date(), lastError: null } },
    { new: true }
  );

  const job =
    claimed ??
    (await CommunicationOutboxJob.findOne({
      _id: outboxJobId,
      schoolId: tracked.job.schoolId,
    }));
  if (!job) {
    throw new BackgroundJobError({
      message: "Outbox job not found",
      category: "PREREQUISITE_FAILED",
    });
  }
  if (String(job.schoolId) !== String(tracked.job.schoolId)) {
    throw new BackgroundJobError({
      message: "Outbox tenant mismatch",
      category: "PREREQUISITE_FAILED",
    });
  }

  const delivery = await CommunicationDelivery.findById(job.deliveryId);
  if (
    job.status === "completed" ||
    delivery?.status === "delivered" ||
    delivery?.outputEntityId
  ) {
    return {
      communicationOutboxJobId: String(job._id),
      deliveryId: String(job.deliveryId),
      skipped: true,
    };
  }

  const communication = await Communication.findById(job.communicationId);
  if (!communication || !delivery) {
    await CommunicationOutboxJob.findByIdAndUpdate(job._id, {
      $set: { status: "failed", lastError: "Communication or delivery no longer exists" },
      $inc: { attempts: 1 },
    });
    throw new BackgroundJobError({
      message: "Communication or delivery no longer exists",
      category: "PREREQUISITE_FAILED",
    });
  }

  try {
    if (job.channel === "in_app") {
      if (!delivery.recipientUserId) throw new Error("In-app delivery has no recipient user");
      const notification = await Notification.create({
        schoolId: communication.schoolId,
        userId: delivery.recipientUserId,
        type: notificationTypeFor(communication.type),
        title: communication.title,
        body: communication.bodyText,
        priority: notificationPriorityFor(communication.priority),
        entityType: "Communication",
        entityId: communication._id,
        actionUrl: communication.actionUrl,
        metadata: {
          communicationId: String(communication._id),
          deliveryId: String(delivery._id),
        },
      });
      await CommunicationDelivery.findByIdAndUpdate(delivery._id, {
        $set: {
          status: "delivered",
          queuedAt: delivery.queuedAt ?? new Date(),
          sentAt: new Date(),
          deliveredAt: new Date(),
          outputEntityType: "Notification",
          outputEntityId: notification._id,
        },
      });
    } else if (job.channel === "email") {
      if (!delivery.destination) throw new Error("Email delivery has no destination");
      const result = await sendTrackedBrevoEmail({
        to: delivery.destination,
        toName: delivery.recipientName,
        subject: communication.title,
        htmlContent: communication.bodyHtml,
        textContent: communication.bodyText,
        templateKey: "SCHOOL_MANUAL_EMAIL",
        schoolId: String(communication.schoolId),
        relatedEntityType: "Communication",
        relatedEntityId: String(communication._id),
        recipientUserId: delivery.recipientUserId ? String(delivery.recipientUserId) : null,
        recipientRole: delivery.recipientRole,
        async: true,
      });
      await CommunicationDelivery.findByIdAndUpdate(delivery._id, {
        $set: {
          status: result.status === "failed" ? "failed" : "queued",
          queuedAt: new Date(),
          sentAt: result.status === "sent" ? new Date() : null,
          providerMessageId: result.providerMessageId || null,
          outputEntityType: "EmailMessage",
          outputEntityId: new Types.ObjectId(result.messageId),
          failureReason:
            result.status === "failed"
              ? "Email provider suppressed or rejected the message"
              : null,
        },
      });
      if (result.status === "failed") {
        throw new BackgroundJobError({
          message: "Email provider suppressed or rejected the message",
          category: "PERMANENT",
        });
      }
    } else if (job.channel === "whatsapp") {
      if (!delivery.destination) throw new Error("WhatsApp delivery has no destination");
      const result = await sendWhatsAppMessage(delivery.destination, "COMMUNICATION_BROADCAST", {
        title: communication.title,
        body: communication.bodyText,
        communicationId: String(communication._id),
      });
      const whatsApp = await WhatsAppMessage.create({
        schoolId: communication.schoolId,
        communicationId: communication._id,
        deliveryId: delivery._id,
        toPhone: delivery.destination,
        body: communication.bodyText,
        status: result.success ? "sent" : "failed",
        provider: result.mode,
        failureReason: result.success ? null : result.error || "WhatsApp send failed",
      });
      await CommunicationDelivery.findByIdAndUpdate(delivery._id, {
        $set: {
          status: result.success ? "sent" : "failed",
          sentAt: result.success ? new Date() : null,
          failureReason: result.success ? null : result.error || "WhatsApp send failed",
          skippedReason: null,
          outputEntityType: "WhatsAppMessage",
          outputEntityId: whatsApp._id,
        },
      });
      if (!result.success) {
        throw new BackgroundJobError({
          message: result.error || "WhatsApp send failed",
          category: "RETRYABLE",
        });
      }
    } else if (job.channel === "sms") {
      if (!delivery.destination) throw new Error("SMS delivery has no destination");
      const result = await sendSmsMessage(delivery.destination, communication.bodyText);
      const sms = await SmsMessage.create({
        schoolId: communication.schoolId,
        communicationId: communication._id,
        deliveryId: delivery._id,
        toPhone: delivery.destination,
        body: communication.bodyText,
        status: result.success ? "sent" : "failed",
        provider: result.mode,
        providerMessageId: result.providerMessageId || null,
        failureReason: result.success ? null : result.error || "SMS send failed",
      });
      await CommunicationDelivery.findByIdAndUpdate(delivery._id, {
        $set: {
          status: result.success ? "sent" : "failed",
          sentAt: result.success ? new Date() : null,
          providerMessageId: result.providerMessageId || null,
          failureReason: result.success ? null : result.error || "SMS send failed",
          skippedReason: null,
          outputEntityType: "SmsMessage",
          outputEntityId: sms._id,
        },
      });
      if (!result.success) {
        throw new BackgroundJobError({
          message: result.error || "SMS send failed",
          category: "RETRYABLE",
        });
      }
    }

    await CommunicationOutboxJob.findByIdAndUpdate(job._id, {
      $set: { status: "completed", lockedAt: null, lastError: null },
      $inc: { attempts: 1 },
    });
    await refreshCommunicationStats(communication._id);
    return {
      communicationOutboxJobId: String(job._id),
      deliveryId: deliveryId ?? String(job.deliveryId),
      channel: job.channel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await CommunicationDelivery.findByIdAndUpdate(job.deliveryId, {
      $set: { status: "failed", failureReason: message },
    });
    await CommunicationOutboxJob.findByIdAndUpdate(job._id, {
      $set: { status: "failed", lastError: message },
      $inc: { attempts: 1 },
    });
    await refreshCommunicationStats(communication._id);
    if (error instanceof BackgroundJobError) throw error;
    throw new BackgroundJobError({
      message,
      category: "RETRYABLE",
    });
  }
}
