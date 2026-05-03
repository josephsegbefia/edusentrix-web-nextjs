import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPlatformAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  action: string;
  entityType?: string | null;
  entityId?: Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const platformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120, index: true },
    entityType: { type: String, default: null, trim: true, maxlength: 80 },
    entityId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

platformAuditLogSchema.index({ schoolId: 1, createdAt: -1 });
platformAuditLogSchema.index({ action: 1, createdAt: -1 });

export const PlatformAuditLog: Model<IPlatformAuditLog> =
  (models.PlatformAuditLog as Model<IPlatformAuditLog>) ||
  model<IPlatformAuditLog>("PlatformAuditLog", platformAuditLogSchema);
