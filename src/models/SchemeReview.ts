import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeReviewDecision =
  | "submitted"
  | "approved"
  | "needs_revision"
  | "rejected"
  | "activated"
  | "archived";

export interface ISchemeReview {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  schemeId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorTeacherId?: Types.ObjectId | null;
  actorRole?: string | null;
  decision: SchemeReviewDecision;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schemeReviewSchema = new Schema<ISchemeReview>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    schemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    actorRole: { type: String, trim: true, maxlength: 80, default: null },
    decision: {
      type: String,
      enum: ["submitted", "approved", "needs_revision", "rejected", "activated", "archived"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 5000, default: null },
  },
  { timestamps: true }
);

schemeReviewSchema.index({ schoolId: 1, schemeId: 1, createdAt: -1 });

export const SchemeReview: Model<ISchemeReview> =
  (models.SchemeReview as Model<ISchemeReview>) ||
  model<ISchemeReview>("SchemeReview", schemeReviewSchema);
