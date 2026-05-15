import { Types } from "mongoose";
import { Communication } from "@/models/Communication";
import { CommunicationAudienceSnapshot } from "@/models/CommunicationAudienceSnapshot";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";
import type { ICommunication } from "@/models/Communication";
import { resolveCommunicationAudience } from "@/lib/communications/audience/resolveAudience";
import {
  routeCommunicationChannels,
  type RoutedCommunicationDelivery,
} from "@/lib/communications/routing/channel-router";

function communicationPriorityScore(priority: ICommunication["priority"]) {
  if (priority === "urgent") return 10;
  if (priority === "high") return 25;
  if (priority === "low") return 75;
  return 50;
}

function safeObject(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

async function createSnapshot(
  communication: ICommunication,
  recipients: Awaited<ReturnType<typeof resolveCommunicationAudience>>["recipients"],
  summary: Awaited<ReturnType<typeof resolveCommunicationAudience>>["summary"],
) {
  return CommunicationAudienceSnapshot.create({
    schoolId: communication.schoolId,
    communicationId: communication._id,
    recipientCount: summary.total,
    channelReach: {
      inApp: summary.inApp,
      email: summary.email,
      whatsapp: summary.whatsapp,
      sms: summary.sms,
      missingContact: summary.missingContact,
    },
    recipients: recipients.map((recipient) => ({
      key: recipient.key,
      userId: recipient.userId ? String(recipient.userId) : null,
      studentId: recipient.studentId ? String(recipient.studentId) : null,
      guardianId: recipient.guardianId ? String(recipient.guardianId) : null,
      role: recipient.role,
      name: recipient.name,
      email: recipient.email ?? null,
      phone: recipient.phone ?? null,
      whatsappPhone: recipient.whatsappPhone ?? null,
      gradeId: recipient.gradeId ? String(recipient.gradeId) : null,
      classGroupId: recipient.classGroupId ? String(recipient.classGroupId) : null,
      reasonIncluded: recipient.reasonIncluded,
    })),
  });
}

async function createDeliveryAndJob(
  communication: ICommunication,
  snapshotId: Types.ObjectId,
  routed: RoutedCommunicationDelivery,
) {
  const delivery = await CommunicationDelivery.create({
    schoolId: communication.schoolId,
    communicationId: communication._id,
    snapshotId,
    channel: routed.channel,
    status: routed.status,
    recipientKey: routed.recipient.key,
    recipientUserId: routed.recipient.userId ?? null,
    recipientStudentId: routed.recipient.studentId ?? null,
    recipientGuardianId: routed.recipient.guardianId ?? null,
    recipientRole: routed.recipient.role,
    recipientName: routed.recipient.name,
    destination: routed.destination ?? null,
    skippedReason: routed.skippedReason ?? null,
    metadata: {
      reasonIncluded: routed.recipient.reasonIncluded,
      gradeId: routed.recipient.gradeId ? String(routed.recipient.gradeId) : null,
      classGroupId: routed.recipient.classGroupId ? String(routed.recipient.classGroupId) : null,
    },
  });

  if (routed.status === "pending") {
    await CommunicationOutboxJob.create({
      schoolId: communication.schoolId,
      communicationId: communication._id,
      deliveryId: delivery._id,
      channel: routed.channel,
      status: "pending",
      priority: communicationPriorityScore(communication.priority),
      payload: {
        title: communication.title,
        bodyHtml: communication.bodyHtml,
        bodyText: communication.bodyText,
        actionUrl: communication.actionUrl,
        metadata: safeObject(communication.metadata),
      },
    });
  }

  return delivery;
}

export async function previewCommunicationAudience(communication: ICommunication) {
  const resolved = await resolveCommunicationAudience({
    schoolId: communication.schoolId,
    audience: communication.audience,
  });
  const routed = await routeCommunicationChannels({
    schoolId: communication.schoolId,
    type: communication.type,
    channels: communication.channels,
    recipients: resolved.recipients,
  });
  return {
    ...resolved,
    channelResults: {
      totalDeliveries: routed.length,
      pending: routed.filter((item) => item.status === "pending").length,
      skipped: routed.filter((item) => item.status === "skipped").length,
      byChannel: communication.channels.reduce<Record<string, { pending: number; skipped: number }>>(
        (acc, channel) => {
          acc[channel] = {
            pending: routed.filter((item) => item.channel === channel && item.status === "pending").length,
            skipped: routed.filter((item) => item.channel === channel && item.status === "skipped").length,
          };
          return acc;
        },
        {},
      ),
    },
  };
}

export async function queueCommunication(communicationId: Types.ObjectId, schoolId: Types.ObjectId) {
  const communication = await Communication.findOne({ _id: communicationId, schoolId });
  if (!communication) throw new Error("Communication not found");
  if (!["draft", "scheduled", "failed"].includes(communication.status)) {
    throw new Error("Only draft, scheduled, or failed communications can be queued");
  }

  await CommunicationDelivery.deleteMany({ communicationId: communication._id });
  await CommunicationOutboxJob.deleteMany({ communicationId: communication._id });

  const resolved = await resolveCommunicationAudience({
    schoolId: communication.schoolId,
    audience: communication.audience,
  });
  const snapshot = await createSnapshot(communication, resolved.recipients, resolved.summary);
  const routed = await routeCommunicationChannels({
    schoolId: communication.schoolId,
    type: communication.type,
    channels: communication.channels,
    recipients: resolved.recipients,
  });

  for (const item of routed) {
    await createDeliveryAndJob(communication, snapshot._id, item);
  }

  const skippedCount = routed.filter((item) => item.status === "skipped").length;
  const queuedCount = routed.filter((item) => item.status === "pending").length;
  communication.status = queuedCount > 0 ? "queued" : "failed";
  communication.stats = {
    audienceCount: resolved.summary.total,
    deliveryCount: routed.length,
    queuedCount,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    skippedCount,
  };
  await communication.save();

  return {
    communication,
    snapshot,
    queuedCount,
    skippedCount,
    recipientCount: resolved.summary.total,
  };
}

export async function refreshCommunicationStats(communicationId: Types.ObjectId) {
  const grouped = await CommunicationDelivery.aggregate<{
    _id: string;
    count: number;
  }>([
    { $match: { communicationId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = new Map(grouped.map((row) => [row._id, row.count]));
  const deliveryCount = grouped.reduce((sum, row) => sum + row.count, 0);
  const sentCount =
    (counts.get("sent") ?? 0) +
    (counts.get("delivered") ?? 0) +
    (counts.get("read") ?? 0);
  const failedCount = counts.get("failed") ?? 0;
  const queuedCount = (counts.get("queued") ?? 0) + (counts.get("pending") ?? 0) + (counts.get("sending") ?? 0);

  const status =
    failedCount > 0 && sentCount > 0 ? "partially_sent" :
    queuedCount > 0 ? "sending" :
    failedCount > 0 ? "failed" :
    sentCount > 0 ? "sent" :
    "queued";

  await Communication.findByIdAndUpdate(communicationId, {
    $set: {
      status,
      sentAt: status === "sent" || status === "partially_sent" ? new Date() : null,
      "stats.deliveryCount": deliveryCount,
      "stats.queuedCount": queuedCount,
      "stats.sentCount": sentCount,
      "stats.deliveredCount": counts.get("delivered") ?? 0,
      "stats.readCount": counts.get("read") ?? 0,
      "stats.failedCount": failedCount,
      "stats.skippedCount": counts.get("skipped") ?? 0,
    },
  });
}
