import { Schema, model, models, Types, type Model } from "mongoose";

import type {
  GuidedAdventureContentV2,
  ExploreSourceContext,
  ExploreAiMetadata,
  ExploreSafetyResult,
  ExploreSchemaVersion,
  ExploreVisibleRole,
} from "@/lib/learn/explore/explore-types";

export type {
  GuidedAdventureContentV2,
  ExploreSourceContext,
  ExploreAiMetadata,
  ExploreSafetyResult,
  ExploreSchemaVersion,
  ExploreVisibleRole,
};

export interface IExploreContentSnapshot {
  _id: Types.ObjectId;
  adventureId: Types.ObjectId;
  generationKey: string;
  contentVersion: string;
  schemaVersion: ExploreSchemaVersion;
  content: GuidedAdventureContentV2;
  sourceContext: ExploreSourceContext;
  aiMetadata: ExploreAiMetadata;
  safetyResult: ExploreSafetyResult;
  visibleToRoles: ExploreVisibleRole[];
  createdAt: Date;
  updatedAt: Date;
}

const exploreSourceContextSchema = new Schema<ExploreSourceContext>(
  {
    schoolId: { type: String, required: true },
    classGroupId: { type: String, required: true },
    subjectId: { type: String, required: true },
    lessonId: { type: String, required: true },
    lessonTitle: { type: String, required: true },
    gradeLevel: { type: String, required: true },
    curriculum: { type: String, default: null },
    academicYearId: { type: String, default: null },
    termId: { type: String, default: null },
  },
  { _id: false }
);

const exploreAiMetadataSchema = new Schema<ExploreAiMetadata>(
  {
    provider: { type: String, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    generatedBy: {
      type: String,
      enum: ["backend_ai"],
      default: "backend_ai",
      required: true,
    },
    generationPromptSummary: { type: String, required: true },
    temperature: { type: Number, default: null },
  },
  { _id: false }
);

const exploreSafetyCheckSchema = new Schema(
  {
    name: { type: String, required: true },
    passed: { type: Boolean, required: true },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      required: true,
    },
    note: { type: String, default: null },
  },
  { _id: false }
);

const exploreSafetyResultSchema = new Schema<ExploreSafetyResult>(
  {
    status: {
      type: String,
      enum: ["passed", "repaired", "blocked", "teacher_review_required"],
      required: true,
    },
    checks: { type: [exploreSafetyCheckSchema], default: [] },
    repairAttempts: { type: Number, default: 0, min: 0 },
    finalNotes: { type: [String], default: [] },
  },
  { _id: false }
);

const exploreContentSnapshotSchema = new Schema<IExploreContentSnapshot>(
  {
    adventureId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreAdventure",
      required: true,
      index: true,
    },
    generationKey: { type: String, required: true, trim: true, index: true },
    contentVersion: { type: String, required: true, trim: true },
    schemaVersion: {
      type: String,
      enum: ["explore_adventure_v2"],
      default: "explore_adventure_v2",
      required: true,
    },
    content: { type: Schema.Types.Mixed, required: true },
    sourceContext: { type: exploreSourceContextSchema, required: true },
    aiMetadata: { type: exploreAiMetadataSchema, required: true },
    safetyResult: { type: exploreSafetyResultSchema, required: true },
    visibleToRoles: {
      type: [String],
      enum: ["student", "parent", "class_teacher", "school_admin", "platform_admin"],
      default: ["student", "class_teacher", "school_admin", "platform_admin"],
    },
  },
  { timestamps: true }
);

exploreContentSnapshotSchema.index({ adventureId: 1, contentVersion: 1 });
exploreContentSnapshotSchema.index({ generationKey: 1 });
exploreContentSnapshotSchema.index({
  "sourceContext.schoolId": 1,
  "sourceContext.classGroupId": 1,
});

export const ExploreContentSnapshot: Model<IExploreContentSnapshot> =
  (models.ExploreContentSnapshot as Model<IExploreContentSnapshot>) ||
  model<IExploreContentSnapshot>(
    "ExploreContentSnapshot",
    exploreContentSnapshotSchema
  );
