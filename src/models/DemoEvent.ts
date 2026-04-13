import { Schema, model, models, Types, type Model } from "mongoose";

export interface IDemoEvent {
  _id: Types.ObjectId;
  leadId?: Types.ObjectId | null;
  sessionId?: Types.ObjectId | null;
  sandboxId?: Types.ObjectId | null;
  schoolId?: Types.ObjectId | null;
  actorRole?: string | null;
  actorUserId?: Types.ObjectId | null;
  eventType: string;
  eventCode: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const demoEventSchema = new Schema<IDemoEvent>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "DemoLead",
      default: null,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSession",
      default: null,
    },
    sandboxId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSandbox",
      default: null,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },
    actorRole: { type: String, default: null },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventType: { type: String, required: true, trim: true },
    eventCode: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

demoEventSchema.index({ sessionId: 1, createdAt: -1 });
demoEventSchema.index({ leadId: 1 });
demoEventSchema.index({ eventCode: 1 });
demoEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 86400 }
);

export const DemoEvent: Model<IDemoEvent> =
  (models.DemoEvent as Model<IDemoEvent>) ||
  model<IDemoEvent>("DemoEvent", demoEventSchema);
