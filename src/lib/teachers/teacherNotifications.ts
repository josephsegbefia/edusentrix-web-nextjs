import mongoose from "mongoose";
import {
  Notification,
  type NotificationPriority,
  type NotificationType,
} from "@/models/Notification";

type CreateTeacherNotificationInput = {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

export async function createTeacherNotification(
  input: CreateTeacherNotificationInput
): Promise<{ created: boolean; duplicate: boolean }> {
  try {
    if (input.dedupeKey) {
      const existing = await Notification.findOne({
        schoolId: input.schoolId,
        userId: input.userId,
        "metadata.dedupeKey": input.dedupeKey,
      })
        .select("_id")
        .lean();

      if (existing) {
        return { created: false, duplicate: true };
      }
    }

    await Notification.create({
      schoolId: input.schoolId,
      userId: input.userId,
      type: input.type || "system",
      title: input.title,
      body: input.body,
      isRead: false,
      priority: input.priority || "normal",
      actionUrl: input.actionUrl || undefined,
      metadata: {
        ...(input.metadata || {}),
        dedupeKey: input.dedupeKey || undefined,
      },
    });

    return { created: true, duplicate: false };
  } catch (error) {
    console.warn("createTeacherNotification failed:", error);
    return { created: false, duplicate: false };
  }
}
