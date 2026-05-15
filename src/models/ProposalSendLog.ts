import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IProposalSendLog {
  _id: Types.ObjectId;
  proposalId: Types.ObjectId;
  recipientEmail: string;
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  attachmentName?: string | null;
  publicViewUrl?: string | null;
  status: "queued" | "sent" | "failed";
  emailMessageId?: Types.ObjectId | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentBy: Types.ObjectId;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const proposalSendLogSchema = new Schema<IProposalSendLog>(
  {
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", required: true, index: true },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    subject: { type: String, required: true, trim: true },
    bodyHtml: { type: String, required: true },
    attachmentName: { type: String, default: null },
    publicViewUrl: { type: String, default: null },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued", index: true },
    emailMessageId: { type: Schema.Types.ObjectId, ref: "EmailMessage", default: null },
    providerMessageId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

proposalSendLogSchema.index({ proposalId: 1, createdAt: -1 });

export const ProposalSendLog: Model<IProposalSendLog> =
  (models.ProposalSendLog as Model<IProposalSendLog>) ||
  model<IProposalSendLog>("ProposalSendLog", proposalSendLogSchema);
