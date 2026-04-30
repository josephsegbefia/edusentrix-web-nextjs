import { Schema, model, models, type Model, type Types } from "mongoose";

export type IAuditScopeType = "platform" | "school";
export type IAuditDomain =
  | "identity"
  | "academics"
  | "finance"
  | "billing"
  | "communication"
  | "applications"
  | "timetable"
  | "system"
  | "email";
export type IAuditTier = 0 | 1 | 2;
export type IAuditResult =
  | "attempted"
  | "succeeded"
  | "failed"
  | "skipped"
  | "compensated";
export type IAuditActorType =
  | "user"
  | "system"
  | "webhook"
  | "job"
  | "ai_assist"
  | "migration";
export type IAuditSensitivity =
  | "low"
  | "moderate"
  | "high"
  | "guardian_only"
  | "financial_secret";
export type IAuditRedactionMode = "none" | "masked" | "hidden";
export type IAuditRetentionClass =
  | "financial_critical"
  | "academic_record"
  | "identity_and_permissions"
  | "operational"
  | "feed_noise";

export interface IAuditEvent {
  _id: Types.ObjectId;
  scopeType: IAuditScopeType;
  scopeId: Types.ObjectId | null;
  domain: IAuditDomain;
  tier: IAuditTier;
  actionCode: string;
  result: IAuditResult;
  occurredAt: Date;
  recordedAt: Date;
  actorType: IAuditActorType;
  actorId?: Types.ObjectId | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  targetEntityType: string;
  targetEntityId: Types.ObjectId;
  secondaryEntityType?: string | null;
  secondaryEntityId?: Types.ObjectId | null;
  reviewedById?: Types.ObjectId | null;
  reviewedByRole?: string | null;
  approvedById?: Types.ObjectId | null;
  approvedByRole?: string | null;
  reasonCode?: string | null;
  reason?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  routePath?: string | null;
  clientSurface?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  metadata?: Record<string, unknown> | null;
  streamKey?: string | null;
  streamSequence?: number | null;
  previousHash?: string | null;
  eventHash?: string | null;
  sensitivity: IAuditSensitivity;
  redactionMode: IAuditRedactionMode;
  retentionClass: IAuditRetentionClass;
  archivedAt?: Date | null;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    scopeType: {
      type: String,
      enum: ["platform", "school"],
      required: true,
      index: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    domain: {
      type: String,
      enum: [
        "identity",
        "academics",
        "finance",
        "billing",
        "communication",
        "applications",
        "timetable",
        "system",
        "email",
      ],
      required: true,
      index: true,
    },
    tier: { type: Number, enum: [0, 1, 2], required: true, index: true },
    actionCode: { type: String, required: true, trim: true, index: true },
    result: {
      type: String,
      enum: ["attempted", "succeeded", "failed", "skipped", "compensated"],
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, index: true },
    recordedAt: { type: Date, required: true, default: () => new Date() },
    actorType: {
      type: String,
      enum: ["user", "system", "webhook", "job", "ai_assist", "migration"],
      required: true,
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: null, trim: true },
    actorEmail: { type: String, default: null, trim: true },
    actorName: { type: String, default: null, trim: true },
    targetEntityType: { type: String, required: true, trim: true },
    targetEntityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    secondaryEntityType: { type: String, default: null, trim: true },
    secondaryEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByRole: { type: String, default: null, trim: true },
    approvedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedByRole: { type: String, default: null, trim: true },
    reasonCode: { type: String, default: null, trim: true },
    reason: { type: String, default: null, trim: true },
    requestId: { type: String, default: null, trim: true, index: true },
    correlationId: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, default: null, trim: true },
    ipAddress: { type: String, default: null, trim: true },
    userAgent: { type: String, default: null, trim: true },
    routePath: { type: String, default: null, trim: true },
    clientSurface: { type: String, default: null, trim: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    changedFields: { type: [String], default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    streamKey: { type: String, default: null, trim: true, index: true },
    streamSequence: { type: Number, default: null, index: true },
    previousHash: { type: String, default: null, trim: true },
    eventHash: { type: String, default: null, trim: true },
    sensitivity: {
      type: String,
      enum: ["low", "moderate", "high", "guardian_only", "financial_secret"],
      required: true,
    },
    redactionMode: {
      type: String,
      enum: ["none", "masked", "hidden"],
      default: "none",
    },
    retentionClass: {
      type: String,
      enum: [
        "financial_critical",
        "academic_record",
        "identity_and_permissions",
        "operational",
        "feed_noise",
      ],
      required: true,
      index: true,
    },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

auditEventSchema.index({ scopeType: 1, scopeId: 1, occurredAt: -1 });
auditEventSchema.index({ targetEntityType: 1, targetEntityId: 1, occurredAt: -1 });
auditEventSchema.index({ actionCode: 1, occurredAt: -1 });
auditEventSchema.index({ actorId: 1, occurredAt: -1 });
auditEventSchema.index({ correlationId: 1 });
auditEventSchema.index({ idempotencyKey: 1 });
auditEventSchema.index({ streamKey: 1, occurredAt: 1 });
auditEventSchema.index({ streamKey: 1, recordedAt: -1 });
auditEventSchema.index({ tier: 1, domain: 1, occurredAt: -1 });
auditEventSchema.index({ result: 1, occurredAt: -1 });
auditEventSchema.index(
  { streamKey: 1, streamSequence: 1 },
  { unique: true, partialFilterExpression: { streamKey: { $type: "string" } } }
);

export const AuditEvent: Model<IAuditEvent> =
  (models.AuditEvent as Model<IAuditEvent>) ||
  model<IAuditEvent>("AuditEvent", auditEventSchema);
