import { Schema, model, models, Types, type Model } from "mongoose";

export interface IDemoLead {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  schoolAddress?: string | null;
  city?: string | null;
  region?: string | null;
  source?: string | null;
  utm?: Record<string, string> | null;
  notes?: string | null;
  status:
    | "new"
    | "active_demo"
    | "completed_demo"
    | "follow_up_due"
    | "converted"
    | "closed_lost";
  linkedApplicationId?: Types.ObjectId | null;
  firstSessionId?: Types.ObjectId | null;
  lastSessionId?: Types.ObjectId | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const demoLeadSchema = new Schema<IDemoLead>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    schoolName: { type: String, required: true, trim: true },
    schoolAddress: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    region: { type: String, default: null, trim: true },
    source: { type: String, default: null, trim: true },
    utm: { type: Schema.Types.Mixed, default: null },
    notes: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: [
        "new",
        "active_demo",
        "completed_demo",
        "follow_up_due",
        "converted",
        "closed_lost",
      ],
      default: "new",
    },
    linkedApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },
    firstSessionId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSession",
      default: null,
    },
    lastSessionId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSession",
      default: null,
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

demoLeadSchema.index({ email: 1 });
demoLeadSchema.index({ status: 1 });
demoLeadSchema.index({ lastSeenAt: -1 });

export const DemoLead: Model<IDemoLead> =
  (models.DemoLead as Model<IDemoLead>) ||
  model<IDemoLead>("DemoLead", demoLeadSchema);
