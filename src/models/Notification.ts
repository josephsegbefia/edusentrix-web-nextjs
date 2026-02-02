// src/models/Notification.ts
import { Schema, model, models, Types } from "mongoose";

export type NotificationType =
  | "grade"
  | "fee"
  | "attendance"
  | "announcement"
  | "message"
  | "reminder"
  | "system";

export type NotificationPriority = "low" | "normal" | "high";

export interface INotification {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;           // Recipient user ID
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  
  // Optional context
  wardId?: Types.ObjectId;          // Related student (for parent notifications)
  entityType?: string;              // e.g., "Invoice", "SubjectGrade"
  entityId?: Types.ObjectId;
  actionUrl?: string;               // Deep link path
  
  metadata?: Record<string, unknown>;
  
  // Push notification tracking
  pushSent?: boolean;
  pushSentAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["grade", "fee", "attendance", "announcement", "message", "reminder", "system"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    wardId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      index: true,
    },
    entityType: {
      type: String,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    actionUrl: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pushSent: {
      type: Boolean,
      default: false,
    },
    pushSentAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, userId: 1, createdAt: -1 });

export const Notification =
  models.Notification || model<INotification>("Notification", notificationSchema);
