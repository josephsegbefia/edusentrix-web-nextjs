import { Schema, model, models, Types, type Model } from "mongoose";

export type MeetingProviderEventStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed";

export interface IMeetingProviderEvent {
  _id: Types.ObjectId;
  meetingId?: Types.ObjectId | null;
  schoolId?: Types.ObjectId | null;
  provider: "livekit";
  providerEventId?: string | null;
  eventType: string;
  status: MeetingProviderEventStatus;
  payload: Record<string, unknown>;
  processedAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const meetingProviderEventSchema = new Schema<IMeetingProviderEvent>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ["livekit"],
      required: true,
      index: true,
    },
    providerEventId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      default: "received",
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

meetingProviderEventSchema.index(
  { provider: 1, providerEventId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerEventId: { $type: "string" } },
  }
);

export const MeetingProviderEvent: Model<IMeetingProviderEvent> =
  (models.MeetingProviderEvent as Model<IMeetingProviderEvent>) ||
  model<IMeetingProviderEvent>("MeetingProviderEvent", meetingProviderEventSchema);
