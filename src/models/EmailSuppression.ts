import { Schema, model, models, Types, type Model } from "mongoose";

export type EmailSuppressionReason =
  | "bounce"
  | "complaint"
  | "manual_block"
  | "unsubscribe_optional";

export type EmailSuppressionScope = "global" | "school";

export interface IEmailSuppression {
  _id: Types.ObjectId;
  email: string;
  schoolId?: Types.ObjectId | null;
  scope: EmailSuppressionScope;
  reason: EmailSuppressionReason;
  categories?: string[];
  sourceProvider?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailSuppressionSchema = new Schema<IEmailSuppression>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    scope: {
      type: String,
      enum: ["global", "school"],
      required: true,
    },
    reason: {
      type: String,
      enum: ["bounce", "complaint", "manual_block", "unsubscribe_optional"],
      required: true,
    },
    categories: [{ type: String, trim: true }],
    sourceProvider: { type: String, default: null, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

emailSuppressionSchema.index({ email: 1, scope: 1, active: 1 });
emailSuppressionSchema.index({ schoolId: 1, active: 1 });

export const EmailSuppression: Model<IEmailSuppression> =
  (models.EmailSuppression as Model<IEmailSuppression>) ||
  model<IEmailSuppression>("EmailSuppression", emailSuppressionSchema);
