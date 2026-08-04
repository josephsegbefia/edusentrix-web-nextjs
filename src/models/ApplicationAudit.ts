/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, model, models, Types } from "mongoose";

export type AuditAction =
  | "submitted"
  | "reviewed"
  | "approved"
  | "rejected"
  | "note"
  | "invite_email_sent"
  | "pipeline_updated"
  | "student_enrolled"
  | "archived"
  | "restored";

export interface IApplicationAudit {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  action: AuditAction;
  by?: Types.ObjectId | null; // platform admin user (or null when public submitter)
  note?: string; // optional reason (e.g., rejection)
  meta?: Record<string, any> | null; // optional extra context
  createdAt: Date;
}

const applicationAuditSchema = new Schema<IApplicationAudit>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "submitted",
        "reviewed",
        "approved",
        "rejected",
        "note",
        "invite_email_sent",
        "pipeline_updated",
        "student_enrolled",
        "archived",
        "restored",
      ],
      required: true,
      index: true,
    },
    by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    note: { type: String },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Helpful read pattern: newest first by default in detail pages
applicationAuditSchema.index({ applicationId: 1, createdAt: -1 });

export const ApplicationAudit =
  models.ApplicationAudit ||
  model<IApplicationAudit>("ApplicationAudit", applicationAuditSchema);
