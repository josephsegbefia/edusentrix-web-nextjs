import { Schema, model, models, Types, type Model } from "mongoose";

export interface IEmailEvent {
  _id: Types.ObjectId;
  emailMessageId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  provider: "brevo" | "spaceship";
  eventType: string;
  providerMessageId?: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
}

const emailEventSchema = new Schema<IEmailEvent>(
  {
    emailMessageId: {
      type: Schema.Types.ObjectId,
      ref: "EmailMessage",
      required: true,
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
      enum: ["brevo", "spaceship"],
      required: true,
    },
    eventType: { type: String, required: true, trim: true },
    providerMessageId: { type: String, default: null, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailEventSchema.index({ providerMessageId: 1 }, { sparse: true });
emailEventSchema.index({ emailMessageId: 1, occurredAt: 1 });

export const EmailEvent: Model<IEmailEvent> =
  (models.EmailEvent as Model<IEmailEvent>) ||
  model<IEmailEvent>("EmailEvent", emailEventSchema);
