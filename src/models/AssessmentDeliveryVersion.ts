import { Schema, model, models, Types, type Model } from "mongoose";

export const ASSESSMENT_DELIVERY_STATUSES = [
  "draft",
  "review",
  "published",
  "active",
  "emergency_paused",
  "closed",
  "superseded",
  "archived",
] as const;

export const ASSESSMENT_DELIVERY_MODES = ["paper"] as const;
export const ASSESSMENT_DELIVERY_RESULT_BINDINGS = ["none", "score_bearing"] as const;

export type AssessmentDeliveryStatus = (typeof ASSESSMENT_DELIVERY_STATUSES)[number];
export type AssessmentDeliveryMode = (typeof ASSESSMENT_DELIVERY_MODES)[number];
export type AssessmentDeliveryResultBinding = (typeof ASSESSMENT_DELIVERY_RESULT_BINDINGS)[number];

export interface IAssessmentDeliveryScheduleSnapshot {
  examSessionId: Types.ObjectId | null;
  examTimetableEntryId: Types.ObjectId | null;
  academicPeriodId: Types.ObjectId;
  scheduledDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  venueId: Types.ObjectId | null;
  roomLabel: string | null;
  classGroupIds: Types.ObjectId[];
}

export interface IAssessmentDeliveryTimingSnapshot {
  durationMinutes: number;
  lateEntryMinutes: number;
  serverAuthoritative: boolean;
}

export interface IAssessmentDeliveryReviewPolicySnapshot {
  reviewRequired: boolean;
  reviewerRole: "school_admin";
  answerKeyAccess: "school_admin_only";
  candidateAccess: "not_available";
}

export interface IAssessmentDeliveryAccessibilityPolicySnapshot {
  extraTimeMinutes: number;
  largePrint: boolean;
  readerOrScribe: boolean;
  notes: string | null;
}

export interface IAssessmentDeliveryVersion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  deliveryKey: string;
  assessmentDefinitionVersionId: Types.ObjectId;
  definitionContentHash: string;
  version: number;
  supersedesVersionId: Types.ObjectId | null;
  title: string;
  mode: AssessmentDeliveryMode;
  academicYearId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  gradeId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
  subjectId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId | null;
  schedule: IAssessmentDeliveryScheduleSnapshot;
  timing: IAssessmentDeliveryTimingSnapshot;
  resultBinding: AssessmentDeliveryResultBinding;
  assessmentPlanId: Types.ObjectId | null;
  assessmentItemId: Types.ObjectId | null;
  reviewPolicy: IAssessmentDeliveryReviewPolicySnapshot;
  accessibilityPolicy: IAssessmentDeliveryAccessibilityPolicySnapshot;
  contentHash: string;
  contentHashAlgorithm: "sha256";
  status: AssessmentDeliveryStatus;
  attribution: {
    createdBy: Types.ObjectId;
    reviewedBy: Types.ObjectId | null;
    publishedBy: Types.ObjectId | null;
    supersededBy: Types.ObjectId | null;
  };
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  supersededAt: Date | null;
  archivedAt: Date | null;
}

const scheduleSchema = new Schema<IAssessmentDeliveryScheduleSnapshot>(
  {
    examSessionId: { type: Schema.Types.ObjectId, ref: "ExamSession", default: null },
    examTimetableEntryId: { type: Schema.Types.ObjectId, ref: "ExamTimetableEntry", default: null },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    scheduledDate: { type: Date, default: null },
    startTime: { type: String, default: null, maxlength: 5 },
    endTime: { type: String, default: null, maxlength: 5 },
    venueId: { type: Schema.Types.ObjectId, ref: "ExamVenue", default: null },
    roomLabel: { type: String, default: null, maxlength: 200 },
    classGroupIds: { type: [Schema.Types.ObjectId], ref: "ClassGroup", default: [] },
  },
  { _id: false }
);

const timingSchema = new Schema<IAssessmentDeliveryTimingSnapshot>(
  {
    durationMinutes: { type: Number, required: true, min: 1, max: 720 },
    lateEntryMinutes: { type: Number, required: true, min: 0, max: 720, default: 0 },
    serverAuthoritative: { type: Boolean, required: true, default: true },
  },
  { _id: false }
);

const reviewPolicySchema = new Schema<IAssessmentDeliveryReviewPolicySnapshot>(
  {
    reviewRequired: { type: Boolean, required: true, default: true },
    reviewerRole: { type: String, enum: ["school_admin"], required: true, default: "school_admin" },
    answerKeyAccess: { type: String, enum: ["school_admin_only"], required: true, default: "school_admin_only" },
    candidateAccess: { type: String, enum: ["not_available"], required: true, default: "not_available" },
  },
  { _id: false }
);

const accessibilityPolicySchema = new Schema<IAssessmentDeliveryAccessibilityPolicySnapshot>(
  {
    extraTimeMinutes: { type: Number, required: true, min: 0, max: 720, default: 0 },
    largePrint: { type: Boolean, required: true, default: false },
    readerOrScribe: { type: Boolean, required: true, default: false },
    notes: { type: String, default: null, maxlength: 2000 },
  },
  { _id: false }
);

const attributionSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    supersededBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const deliverySchema = new Schema<IAssessmentDeliveryVersion>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    deliveryKey: { type: String, required: true, trim: true, maxlength: 240, index: true },
    assessmentDefinitionVersionId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentDefinitionVersion",
      required: true,
      index: true,
    },
    definitionContentHash: { type: String, required: true, length: 64 },
    version: { type: Number, required: true, min: 1 },
    supersedesVersionId: { type: Schema.Types.ObjectId, ref: "AssessmentDeliveryVersion", default: null },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    mode: { type: String, enum: [...ASSESSMENT_DELIVERY_MODES], required: true, default: "paper" },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", required: true },
    classGroupIds: { type: [Schema.Types.ObjectId], ref: "ClassGroup", default: [] },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null },
    schedule: { type: scheduleSchema, required: true },
    timing: { type: timingSchema, required: true },
    resultBinding: { type: String, enum: [...ASSESSMENT_DELIVERY_RESULT_BINDINGS], required: true },
    assessmentPlanId: { type: Schema.Types.ObjectId, ref: "AssessmentPlan", default: null },
    assessmentItemId: { type: Schema.Types.ObjectId, ref: "AssessmentItem", default: null },
    reviewPolicy: { type: reviewPolicySchema, required: true },
    accessibilityPolicy: { type: accessibilityPolicySchema, required: true },
    contentHash: { type: String, required: true, length: 64 },
    contentHashAlgorithm: { type: String, enum: ["sha256"], required: true },
    status: { type: String, enum: [...ASSESSMENT_DELIVERY_STATUSES], required: true, default: "draft", index: true },
    attribution: { type: attributionSchema, required: true },
    reviewedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    supersededAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

deliverySchema.index(
  { schoolId: 1, deliveryKey: 1, version: 1 },
  { unique: true, name: "assess_delivery_version_unique" }
);
deliverySchema.index(
  { schoolId: 1, deliveryKey: 1, contentHash: 1 },
  { unique: true, name: "assess_delivery_content_hash_unique" }
);
deliverySchema.index({ schoolId: 1, assessmentDefinitionVersionId: 1, version: -1 });
deliverySchema.index({ schoolId: 1, status: 1, updatedAt: -1 });

const LIFECYCLE_PATHS = new Set([
  "status",
  "reviewedAt",
  "publishedAt",
  "supersededAt",
  "archivedAt",
  "updatedAt",
  "createdAt",
  "attribution",
  "attribution.reviewedBy",
  "attribution.publishedBy",
  "attribution.supersededBy",
]);

function updatePaths(update: Record<string, unknown>) {
  return Object.keys(update).flatMap((operator) => {
    const value = update[operator];
    if (operator.startsWith("$")) {
      return value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [];
    }
    return [operator];
  });
}

function assertPublishedContentImmutable(update: unknown) {
  if (!update || typeof update !== "object") throw new Error("Published assessment deliveries are immutable");
  const paths = updatePaths(update as Record<string, unknown>);
  if (paths.some((path) => !LIFECYCLE_PATHS.has(path))) {
    throw new Error("Published assessment deliveries are immutable");
  }
}

deliverySchema.pre("findOneAndUpdate", function () {
  assertPublishedContentImmutable(this.getUpdate());
});
deliverySchema.pre("updateOne", function () {
  assertPublishedContentImmutable(this.getUpdate());
});
deliverySchema.pre("updateMany", function () {
  assertPublishedContentImmutable(this.getUpdate());
});

deliverySchema.pre("save", async function () {
  if (this.isNew) return;
  const existing = await (this.constructor as Model<IAssessmentDeliveryVersion>)
    .findById(this._id)
    .select("status")
    .lean<{ status: AssessmentDeliveryStatus }>();
  if (!existing || existing.status === "draft" || existing.status === "review") return;
  const changed = this.modifiedPaths().filter((path) => path !== "updatedAt");
  if (changed.some((path) => !LIFECYCLE_PATHS.has(path))) {
    throw new Error("Published assessment deliveries are immutable");
  }
});

export const AssessmentDeliveryVersion: Model<IAssessmentDeliveryVersion> =
  (models.AssessmentDeliveryVersion as Model<IAssessmentDeliveryVersion>) ||
  model<IAssessmentDeliveryVersion>("AssessmentDeliveryVersion", deliverySchema);
