import { Schema, model, models, Types, type Model } from "mongoose";

import type {
  ExploreAdventureStatus,
  ExploreAdventureReviewStatus,
  ExploreMissionType,
  ExploreDifficulty,
  ExploreAdventureCreatedBy,
} from "@/lib/learn/explore/explore-types";

export type {
  ExploreAdventureStatus,
  ExploreAdventureReviewStatus,
  ExploreMissionType,
  ExploreDifficulty,
  ExploreAdventureCreatedBy,
};

export interface IExploreAdventure {
  _id: Types.ObjectId;
  generationKey: string;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  gradeLevel: string;
  title: string;
  subjectName: string;
  sourceLessonTitle: string;
  difficulty: ExploreDifficulty;
  estimatedMinutes: number;
  missionType: ExploreMissionType;
  status: ExploreAdventureStatus;
  reviewStatus: ExploreAdventureReviewStatus;
  currentSnapshotId: Types.ObjectId;
  createdBy: ExploreAdventureCreatedBy;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const exploreAdventureSchema = new Schema<IExploreAdventure>(
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
    title: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    sourceLessonTitle: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["easy", "standard", "stretch"],
      default: "standard",
      required: true,
    },
    estimatedMinutes: { type: Number, default: 10, min: 5, max: 30 },
    missionType: {
      type: String,
      enum: [
        "detective",
        "field_trip",
        "story_lab",
        "maker_challenge",
        "culture_link",
        "home_lab",
        "career_link",
        "ghana_connection",
        "future_world",
        "mistake_buster",
        "leo_rescue",
        "parent_challenge",
      ],
      default: "story_lab",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "ready",
        "teacher_review_recommended",
        "teacher_approved",
        "hidden",
        "blocked",
        "reported",
        "archived",
      ],
      default: "teacher_review_recommended",
      required: true,
      index: true,
    },
    reviewStatus: {
      type: String,
      enum: ["not_reviewed", "reviewed", "approved", "needs_changes", "rejected"],
      default: "not_reviewed",
      required: true,
      index: true,
    },
    currentSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreContentSnapshot",
      required: true,
    },
    createdBy: {
      type: String,
      enum: ["leo_ai", "teacher", "platform_admin"],
      default: "leo_ai",
      required: true,
    },
    generatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

exploreAdventureSchema.index({ generationKey: 1 }, { unique: true });
exploreAdventureSchema.index({
  schoolId: 1,
  classGroupId: 1,
  subjectOfferingId: 1,
  lessonId: 1,
});
exploreAdventureSchema.index({ status: 1, reviewStatus: 1 });
exploreAdventureSchema.index({ schoolId: 1, classGroupId: 1, updatedAt: -1 });

export const ExploreAdventure: Model<IExploreAdventure> =
  (models.ExploreAdventure as Model<IExploreAdventure>) ||
  model<IExploreAdventure>("ExploreAdventure", exploreAdventureSchema);
