import { Types } from "mongoose";
import { Communication } from "@/models/Communication";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";
import { Notification, type NotificationPriority, type NotificationType } from "@/models/Notification";
import { SmsMessage } from "@/models/SmsMessage";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { refreshCommunicationStats } from "@/lib/communications/delivery/communicationDeliveryService";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { sendSmsMessage } from "@/lib/notifications/sms";

type ProcessOutboxInput = {
  schoolId?: Types.ObjectId;
  communicationId?: Types.ObjectId;
  limit?: number;
};

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

async function markJobFailed(jobId: Types.ObjectId, deliveryId: Types.ObjectId, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await CommunicationDelivery.findByIdAndUpdate(deliveryId, {
    $set: { status: "failed", failureReason: message },
  });
  await CommunicationOutboxJob.findByIdAndUpdate(jobId, {
    $set: { status: "failed", lastError: message },
    $inc: { attempts: 1 },
  });
}

export async function processCommunicationOutbox(input: ProcessOutboxInput = {}) {
  const query: Record<string, unknown> = { status: "pending" };
  if (input.schoolId) query.schoolId = input.schoolId;
  if (input.communicationId) query.communicationId = input.communicationId;

  const jobs = await CommunicationOutboxJob.find(query)
    .sort({ priority: 1, createdAt: 1 })
    .limit(Math.max(1, Math.min(input.limit ?? 50, 200)));

  let completed = 0;
  let failed = 0;
  const touchedCommunications = new Set<string>();

  for (const job of jobs) {
    touchedCommunications.add(String(job.communicationId));
    await CommunicationOutboxJob.findByIdAndUpdate(job._id, {
      $set: { status: "running", lockedAt: new Date() },
    });

    const [communication, delivery] = await Promise.all([
      Communication.findById(job.communicationId),
      CommunicationDelivery.findById(job.deliveryId),
    ]);

    if (!communication || !delivery) {
      await markJobFailed(job._id, job.deliveryId, "Communication or delivery no longer exists");
      failed += 1;
      continue;
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
          async: false,
        });
        await CommunicationDelivery.findByIdAndUpdate(delivery._id, {
          $set: {
            status: result.status === "sent" ? "sent" : result.status === "failed" ? "failed" : "queued",
            queuedAt: new Date(),
            sentAt: result.status === "sent" ? new Date() : null,
            providerMessageId: result.providerMessageId || null,
            outputEntityType: "EmailMessage",
            outputEntityId: new Types.ObjectId(result.messageId),
            failureReason: result.status === "failed" ? "Email provider suppressed or rejected the message" : null,
          },
        });
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
      }

      await CommunicationOutboxJob.findByIdAndUpdate(job._id, {
        $set: { status: "completed", lockedAt: null, lastError: null },
        $inc: { attempts: 1 },
      });
      completed += 1;
    } catch (error) {
      await markJobFailed(job._id, job.deliveryId, error);
      failed += 1;
    }
  }

  for (const communicationId of touchedCommunications) {
    await refreshCommunicationStats(new Types.ObjectId(communicationId));
  }

  return { processed: jobs.length, completed, failed };
}
