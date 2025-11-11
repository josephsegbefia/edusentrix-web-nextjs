import { Schema, model, models, Types } from "mongoose";
import {
  GHANA_REGIONS,
  type GhanaRegion,
} from "@/constants/ghanaRegions";

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
  status: "submitted" | "reviewed" | "approved" | "rejected";
  linkedSchoolId?: Types.ObjectId | null;
  processedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    adminFirstName: { type: String, required: true },
    adminLastName: { type: String, required: true },
    adminEmail: { type: String, required: true, lowercase: true, index: true },
    adminPhone: String,
    schoolName: { type: String, required: true },
    schoolType: { type: String, enum: ["Basic", "Secondary"], required: true },
    city: String,
    region: { type: String, enum: GHANA_REGIONS, required: true },
    message: String,
    status: {
      type: String,
      enum: ["submitted", "reviewed", "approved", "rejected"],
      default: "submitted",
    },
    linkedSchoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

applicationSchema.index({ adminEmail: 1 });
applicationSchema.index({ status: 1, createdAt: 1 });
applicationSchema.index({ schoolType: 1 });
applicationSchema.index({ schoolName: 1 });

export const Application =
  models.Application || model<IApplication>("Application", applicationSchema);
