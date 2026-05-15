import { Schema, model, models, type Model, type Types } from "mongoose";

export type ProposalActivityAction =
  | "created"
  | "updated"
  | "pdf_generated"
  | "sent"
  | "status_changed"
  | "follow_up_added"
  | "archived"
  | "duplicated"
  | "public_link_updated";

export interface IProposalActivity {
  _id: Types.ObjectId;
  proposalId: Types.ObjectId;
  action: ProposalActivityAction;
  message: string;
  metadata?: Record<string, unknown> | null;
  actorId?: Types.ObjectId | null;
  createdAt: Date;
}

const proposalActivitySchema = new Schema<IProposalActivity>(
  {
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", required: true, index: true },
    action: {
      type: String,
      enum: ["created", "updated", "pdf_generated", "sent", "status_changed", "follow_up_added", "archived", "duplicated", "public_link_updated"],
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

proposalActivitySchema.index({ proposalId: 1, createdAt: -1 });

export const ProposalActivity: Model<IProposalActivity> =
  (models.ProposalActivity as Model<IProposalActivity>) ||
  model<IProposalActivity>("ProposalActivity", proposalActivitySchema);
