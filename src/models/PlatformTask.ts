import { Schema, model, models, type Model, type Types } from "mongoose";

export const PLATFORM_TASK_CATEGORIES = [
  "school_onboarding",
  "data_import",
  "academic_setup",
  "payment_setup",
  "subscription",
  "support",
  "training",
  "bug_investigation",
  "client_follow_up",
  "custom",
] as const;

export const PLATFORM_TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export type PlatformTaskCategory = (typeof PLATFORM_TASK_CATEGORIES)[number];
export type PlatformTaskStatus = (typeof PLATFORM_TASK_STATUSES)[number];
export type PlatformTaskPriority = "low" | "normal" | "high" | "urgent";

export interface IPlatformTask {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  title: string;
  description?: string | null;
  category: PlatformTaskCategory;
  priority: PlatformTaskPriority;
  status: PlatformTaskStatus;
  assignedToUserId?: Types.ObjectId | null;
  assignedByUserId: Types.ObjectId;
  dueAt?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: Types.ObjectId | null;
  checklist: Array<{
    id: string;
    label: string;
    completed: boolean;
    completedAt?: Date | null;
    completedByUserId?: Types.ObjectId | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformTaskSchema = new Schema<IPlatformTask>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    category: { type: String, enum: PLATFORM_TASK_CATEGORIES, required: true, index: true },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    status: { type: String, enum: PLATFORM_TASK_STATUSES, default: "todo", index: true },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dueAt: { type: Date, default: null, index: true },
    relatedEntityType: { type: String, trim: true, maxlength: 80, default: null },
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },
    checklist: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true, trim: true, maxlength: 180 },
          completed: { type: Boolean, default: false },
          completedAt: { type: Date, default: null },
          completedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

PlatformTaskSchema.index({ status: 1, priority: 1, dueAt: 1 });
PlatformTaskSchema.index({ schoolId: 1, status: 1, dueAt: 1 });

export const PlatformTask: Model<IPlatformTask> =
  (models.PlatformTask as Model<IPlatformTask>) ||
  model<IPlatformTask>("PlatformTask", PlatformTaskSchema);
