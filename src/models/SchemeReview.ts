import { Schema, model, models, type Model, type Types } from "mongoose";

export type SchemeReviewDecision = "submitted" | "changes_requested" | "approved";

export interface ISchemeReview {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  schemeId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorTeacherId?: Types.ObjectId | null;
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
    decision: {
      type: String,
      enum: ["submitted", "changes_requested", "approved"],
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
