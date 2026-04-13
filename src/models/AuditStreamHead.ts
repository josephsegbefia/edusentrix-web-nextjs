import { Schema, model, models, type Model } from "mongoose";

/**
 * Serialized tail for hash-chain appends per streamKey (EDUSENTRIX_AUDIT_HARDENING_SPEC §7.7).
 */
export interface IAuditStreamHead {
  streamKey: string;
  lastSeq: number;
  lastHash: string;
}

const auditStreamHeadSchema = new Schema<IAuditStreamHead>(
  {
    streamKey: { type: String, required: true, unique: true, trim: true },
    lastSeq: { type: Number, required: true, min: 0, default: 0 },
    lastHash: { type: String, required: true, default: () => "0".repeat(64) },
  },
  { timestamps: true }
);

auditStreamHeadSchema.index({ streamKey: 1 }, { unique: true });

export const AuditStreamHead: Model<IAuditStreamHead> =
  (models.AuditStreamHead as Model<IAuditStreamHead>) ||
  model<IAuditStreamHead>("AuditStreamHead", auditStreamHeadSchema);
