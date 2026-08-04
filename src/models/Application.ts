import { Schema, model, models, Types, type Model } from "mongoose";
import {
  GHANA_REGIONS,
  type GhanaRegion,
} from "@/constants/ghanaRegions";
import {
  APPLICATION_PIPELINE_STAGES,
  type ApplicationPipelineStage,
} from "@/constants/application-pipeline";

export interface IApplication {
  _id: Types.ObjectId;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string;
  schoolName: string;
  schoolType: "Basic" | "Secondary";
  city?: string;
  region: GhanaRegion;
  message?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion?: string;
  privacyVersion?: string;
  policyAcceptedAt?: Date | null;
  policyAcceptedIp?: string | null;
  policyAcceptedUserAgent?: string | null;
  status: "submitted" | "reviewed" | "approved" | "rejected";
  /** Archived applications stay available to platform admins but leave the active queue. */
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  /** Sales / pipeline stage (optional on legacy documents). */
  stage?: ApplicationPipelineStage;
  nextActionAt?: Date | null;
  ownerUserId?: Types.ObjectId | null;
  linkedSchoolId?: Types.ObjectId | null;
  /** First learner created from this application (platform enroll flow). */
  enrolledStudentId?: Types.ObjectId | null;
  processedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    adminFirstName: { type: String, required: true },
    adminLastName: { type: String, required: true },
    adminEmail: { type: String, required: true, lowercase: true },
    adminPhone: String,
    schoolName: { type: String, required: true },
    schoolType: { type: String, enum: ["Basic", "Secondary"], required: true },
    city: String,
    region: { type: String, enum: GHANA_REGIONS, required: true },
    message: String,
    termsAccepted: { type: Boolean, default: false },
    privacyAccepted: { type: Boolean, default: false },
    termsVersion: { type: String, default: null },
    privacyVersion: { type: String, default: null },
    policyAcceptedAt: { type: Date, default: null },
    policyAcceptedIp: { type: String, default: null },
    policyAcceptedUserAgent: { type: String, default: null },
    status: {
      type: String,
      enum: ["submitted", "reviewed", "approved", "rejected"],
      default: "submitted",
    },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    linkedSchoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },
    enrolledStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    stage: {
      type: String,
      enum: APPLICATION_PIPELINE_STAGES,
      default: "lead",
    },
    nextActionAt: { type: Date, default: null, index: true },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ adminEmail: 1 });
applicationSchema.index({ status: 1, createdAt: 1 });
applicationSchema.index({ archivedAt: 1, createdAt: -1 });
applicationSchema.index({ schoolType: 1 });
applicationSchema.index({ schoolName: 1 });
applicationSchema.index({ stage: 1, createdAt: -1 });

// Next.js can retain a compiled Mongoose model during development. Add newly
// introduced archive fields to that cached schema so archive actions work
// without requiring a dev-server restart after hot reload.
const cachedApplicationModel = models.Application as Model<IApplication> | undefined;
if (cachedApplicationModel && !cachedApplicationModel.schema.path("archivedAt")) {
  cachedApplicationModel.schema.add({
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  });
}

export const Application =
  cachedApplicationModel || model<IApplication>("Application", applicationSchema);
