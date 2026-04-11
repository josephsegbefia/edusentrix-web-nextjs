import { Schema, model, models, Types, type Model } from "mongoose";

export type EmailRateWindowScopeType =
  | "global"
  | "school"
  | "user"
  | "sender_family";

export interface IEmailRateWindow {
  _id: Types.ObjectId;
  scopeType: EmailRateWindowScopeType;
  scopeKey: string;
  trafficClass: "transactional" | "manual" | "bulk" | "digest";
  windowStart: Date;
  windowMinutes: number;
  sentCount: number;
  deferredCount: number;
  bounceCount: number;
  complaintCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const emailRateWindowSchema = new Schema<IEmailRateWindow>(
  {
    scopeType: {
      type: String,
      enum: ["global", "school", "user", "sender_family"],
      required: true,
    },
    scopeKey: { type: String, required: true, trim: true },
    trafficClass: {
      type: String,
      enum: ["transactional", "manual", "bulk", "digest"],
      required: true,
    },
    windowStart: { type: Date, required: true },
    windowMinutes: { type: Number, required: true },
    sentCount: { type: Number, default: 0 },
    deferredCount: { type: Number, default: 0 },
    bounceCount: { type: Number, default: 0 },
    complaintCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

emailRateWindowSchema.index(
  { scopeType: 1, scopeKey: 1, trafficClass: 1, windowStart: 1 },
  { unique: true },
);

export const EmailRateWindow: Model<IEmailRateWindow> =
  (models.EmailRateWindow as Model<IEmailRateWindow>) ||
  model<IEmailRateWindow>("EmailRateWindow", emailRateWindowSchema);
