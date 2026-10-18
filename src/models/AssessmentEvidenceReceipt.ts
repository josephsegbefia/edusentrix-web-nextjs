import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IAssessmentEvidenceReceipt {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  evidencePageId: Types.ObjectId;
  receiptKey: string;
  status: "confirmed";
  digest: string;
  sizeBytes: number;
  issuedToUserId: Types.ObjectId;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const receiptSchema = new Schema<IAssessmentEvidenceReceipt>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  evidencePageId: { type: Schema.Types.ObjectId, ref: "AssessmentEvidencePage", required: true },
  receiptKey: { type: String, required: true, trim: true, maxlength: 240 },
  status: { type: String, enum: ["confirmed"], required: true, default: "confirmed" },
  digest: { type: String, required: true, length: 64, match: /^[a-f0-9]{64}$/ },
  sizeBytes: { type: Number, required: true, min: 1 },
  issuedToUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  issuedAt: { type: Date, required: true, default: () => new Date() },
}, { timestamps: true });
receiptSchema.index({ schoolId: 1, evidencePageId: 1 }, { unique: true, name: "assess_evidence_receipt_page_unique" });
receiptSchema.index({ schoolId: 1, receiptKey: 1 }, { unique: true, name: "assess_evidence_receipt_key_unique" });

export const AssessmentEvidenceReceipt: Model<IAssessmentEvidenceReceipt> =
  (models.AssessmentEvidenceReceipt as Model<IAssessmentEvidenceReceipt>) ||
  model<IAssessmentEvidenceReceipt>("AssessmentEvidenceReceipt", receiptSchema);
