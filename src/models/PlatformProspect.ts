import { Schema, model, models, Types, type Model } from "mongoose";

export type PlatformProspectStatus =
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "demo_done"
  | "proposal_preparing"
  | "proposal_sent"
  | "follow_up_due"
  | "won"
  | "lost"
  | "on_hold";

export interface IPlatformProspect {
  _id: Types.ObjectId;
  schoolName: string;
  location?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  source?: string | null;
  status: PlatformProspectStatus;
  priority: "low" | "normal" | "high";
  notes?: string | null;
  ownerUserId?: Types.ObjectId | null;
  latestProposalId?: Types.ObjectId | null;
  proposalCount: number;
  contactedAt?: Date | null;
  meetingAt?: Date | null;
  demoAt?: Date | null;
  proposalSentAt?: Date | null;
  lastFollowUpAt?: Date | null;
  nextFollowUpAt?: Date | null;
  outcomeReason?: string | null;
  createdByUserId?: Types.ObjectId | null;
  updatedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformProspectSchema = new Schema<IPlatformProspect>(
  {
    schoolName: { type: String, required: true, trim: true, index: true },
    location: { type: String, default: "", trim: true },
    contactName: { type: String, default: "", trim: true },
    contactTitle: { type: String, default: "", trim: true },
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    source: { type: String, default: "manual", trim: true },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "meeting_scheduled",
        "demo_done",
        "proposal_preparing",
        "proposal_sent",
        "follow_up_due",
        "won",
        "lost",
        "on_hold",
      ],
      default: "new",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal", index: true },
    notes: { type: String, default: "", trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    latestProposalId: { type: Schema.Types.ObjectId, ref: "Proposal", default: null },
    proposalCount: { type: Number, default: 0 },
    contactedAt: { type: Date, default: null },
    meetingAt: { type: Date, default: null },
    demoAt: { type: Date, default: null },
    proposalSentAt: { type: Date, default: null },
    lastFollowUpAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null, index: true },
    outcomeReason: { type: String, default: "", trim: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

platformProspectSchema.index({
  schoolName: "text",
  contactName: "text",
  contactEmail: "text",
  contactPhone: "text",
  location: "text",
});
platformProspectSchema.index({ status: 1, updatedAt: -1 });

export const PlatformProspect: Model<IPlatformProspect> =
  (models.PlatformProspect as Model<IPlatformProspect>) ||
  model<IPlatformProspect>("PlatformProspect", platformProspectSchema);
