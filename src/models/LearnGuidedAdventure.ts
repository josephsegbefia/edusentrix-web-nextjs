import { Schema, model, models, Types, type Model } from "mongoose";

export type LearnGuidedAdventureStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "abandoned";

export interface ILearnGuidedAdventure {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  title: string;
  topic?: string | null;
  status: LearnGuidedAdventureStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  progressPercent: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnGuidedAdventureSchema = new Schema<ILearnGuidedAdventure>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      default: null,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      default: null,
      index: true,
    },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    topic: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "abandoned"],
      default: "not_started",
      required: true,
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

learnGuidedAdventureSchema.index({ schoolId: 1, updatedAt: -1 });
learnGuidedAdventureSchema.index({ studentId: 1, status: 1, updatedAt: -1 });
learnGuidedAdventureSchema.index({
  schoolId: 1,
  studentId: 1,
  "metadata.sessionId": 1,
});
learnGuidedAdventureSchema.index({ schoolId: 1, classGroupId: 1, updatedAt: -1 });

export const LearnGuidedAdventure: Model<ILearnGuidedAdventure> =
  (models.LearnGuidedAdventure as Model<ILearnGuidedAdventure>) ||
  model<ILearnGuidedAdventure>(
    "LearnGuidedAdventure",
    learnGuidedAdventureSchema
  );
