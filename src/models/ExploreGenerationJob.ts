import { Schema, model, models, Types, type Model } from "mongoose";

import type {
  ExploreGenerationJobStatus,
  ExploreGenerationMode,
} from "@/lib/learn/explore/explore-types";

export type { ExploreGenerationJobStatus, ExploreGenerationMode };

export interface IExploreGenerationJob {
  _id: Types.ObjectId;
  generationKey: string;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  gradeLevel: string;
  mode: ExploreGenerationMode;
  status: ExploreGenerationJobStatus;
  adventureId?: Types.ObjectId | null;
  contentSnapshotId?: Types.ObjectId | null;
  requestedByStudentId: Types.ObjectId;
  attempts: number;
  maxAttempts: number;
  lockedAt?: Date | null;
  lockExpiresAt?: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const exploreGenerationJobSchema = new Schema<IExploreGenerationJob>(
  {
    generationKey: { type: String, required: true, trim: true },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "LessonSession",
      required: true,
      index: true,
    },
    gradeLevel: { type: String, required: true, trim: true },
    mode: {
      type: String,
      enum: ["recommended", "go_deeper", "mistake_buster", "challenge"],
      default: "go_deeper",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "generating",
        "safety_checking",
        "repairing",
        "ready",
        "failed",
        "blocked",
      ],
      default: "pending",
      required: true,
      index: true,
    },
    adventureId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreAdventure",
      default: null,
    },
    contentSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreContentSnapshot",
      default: null,
    },
    requestedByStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 2, min: 1 },
    lockedAt: { type: Date, default: null },
    lockExpiresAt: { type: Date, default: null, index: true },
    errorCode: { type: String, default: null, trim: true },
    errorMessage: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

exploreGenerationJobSchema.index({ generationKey: 1 }, { unique: true });
exploreGenerationJobSchema.index({ status: 1, lockExpiresAt: 1 });
exploreGenerationJobSchema.index({
  schoolId: 1,
  classGroupId: 1,
  lessonId: 1,
});

export const ExploreGenerationJob: Model<IExploreGenerationJob> =
  (models.ExploreGenerationJob as Model<IExploreGenerationJob>) ||
  model<IExploreGenerationJob>("ExploreGenerationJob", exploreGenerationJobSchema);
