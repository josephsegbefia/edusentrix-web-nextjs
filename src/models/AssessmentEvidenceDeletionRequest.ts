import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IAssessmentEvidenceDeletionRequest {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  evidencePageId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  requestKey: string;
  reason: string;
  status: "requested" | "denied";
  denialReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const requestSchema = new Schema<IAssessmentEvidenceDeletionRequest>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  evidencePageId: { type: Schema.Types.ObjectId, ref: "AssessmentEvidencePage", required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  requestKey: { type: String, required: true, trim: true, maxlength: 240 },
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ["requested", "denied"], required: true },
  denialReason: { type: String, trim: true, maxlength: 1000, default: null },
}, { timestamps: true });
requestSchema.index({ schoolId: 1, requestKey: 1 }, { unique: true, name: "assess_evidence_deletion_request_key_unique" });
requestSchema.index({ schoolId: 1, evidencePageId: 1, createdAt: -1 });

export const AssessmentEvidenceDeletionRequest: Model<IAssessmentEvidenceDeletionRequest> =
  (models.AssessmentEvidenceDeletionRequest as Model<IAssessmentEvidenceDeletionRequest>) ||
  model<IAssessmentEvidenceDeletionRequest>("AssessmentEvidenceDeletionRequest", requestSchema);
