import { Schema, model, models, type Model, type Types } from "mongoose";
import { ProposalTemplateSectionSchema, type IProposalTemplateSection, type ProposalType } from "@/models/ProposalTemplate";

export type ProposalStatus =
  | "draft"
  | "ready"
  | "sent"
  | "followed_up"
  | "demo_scheduled"
  | "pilot_started"
  | "accepted"
  | "rejected"
  | "archived";

export interface IProposalPricing {
  currency: "GHS" | "USD";
  setupFee?: number | null;
  recurringFee?: number | null;
  cadence?: "monthly" | "termly" | "annual" | null;
  studentRange?: string | null;
  discountNote?: string | null;
  paymentTerms?: string | null;
}

export interface IProposal {
  _id: Types.ObjectId;
  schoolName: string;
  schoolLocation?: string | null;
  schoolId?: Types.ObjectId | null;
  leadId?: Types.ObjectId | null;
  applicationId?: Types.ObjectId | null;
  source: "manual" | "school_record" | "lead" | "demo_visit" | "application";
  recipientName?: string | null;
  recipientTitle?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  templateId?: Types.ObjectId | null;
  title: string;
  proposalType: ProposalType;
  selectedModules: string[];
  sections: IProposalTemplateSection[];
  pricing?: IProposalPricing | null;
  status: ProposalStatus;
  version: number;
  contentHash?: string | null;
  pdfDataBase64?: string | null;
  pdfFileName?: string | null;
  pdfStorageKey?: string | null;
  lastGeneratedAt?: Date | null;
  lastGeneratedVersion?: number | null;
  lastSentVersion?: number | null;
  publicToken?: string | null;
  publicViewEnabled: boolean;
  publicTokenExpiresAt?: Date | null;
  publicAccessRevokedAt?: Date | null;
  publicViewCount: number;
  lastViewedAt?: Date | null;
  preparedByName: string;
  preparedByUserId?: Types.ObjectId | null;
  ownerUserId: Types.ObjectId;
  assignedToUserId?: Types.ObjectId | null;
  collaboratorUserIds: Types.ObjectId[];
  visibility: "platform_admins" | "assigned_only";
  sentAt?: Date | null;
  sentBy?: Types.ObjectId | null;
  nextFollowUpDate?: Date | null;
  followUpNotes?: string | null;
  lastFollowedUpAt?: Date | null;
  internalNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const proposalPricingSchema = new Schema<IProposalPricing>(
  {
    currency: { type: String, enum: ["GHS", "USD"], default: "GHS" },
    setupFee: { type: Number, default: null },
    recurringFee: { type: Number, default: null },
    cadence: { type: String, enum: ["monthly", "termly", "annual", null], default: null },
    studentRange: { type: String, default: "", trim: true },
    discountNote: { type: String, default: "", trim: true },
    paymentTerms: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const proposalSchema = new Schema<IProposal>(
  {
    schoolName: { type: String, required: true, trim: true, index: true },
    schoolLocation: { type: String, default: "", trim: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "DemoLead", default: null, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null, index: true },
    source: {
      type: String,
      enum: ["manual", "school_record", "lead", "demo_visit", "application"],
      default: "manual",
      index: true,
    },
    recipientName: { type: String, default: "", trim: true },
    recipientTitle: { type: String, default: "", trim: true },
    recipientEmail: { type: String, default: "", trim: true, lowercase: true },
    recipientPhone: { type: String, default: "", trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: "ProposalTemplate", default: null },
    title: { type: String, required: true, trim: true },
    proposalType: {
      type: String,
      enum: ["general", "pilot", "full_implementation", "pricing", "demo_follow_up"],
      required: true,
      index: true,
    },
    selectedModules: { type: [String], default: [] },
    sections: { type: [ProposalTemplateSectionSchema], default: [] },
    pricing: { type: proposalPricingSchema, default: () => ({ currency: "GHS" }) },
    status: {
      type: String,
      enum: ["draft", "ready", "sent", "followed_up", "demo_scheduled", "pilot_started", "accepted", "rejected", "archived"],
      default: "draft",
      index: true,
    },
    version: { type: Number, default: 1 },
    contentHash: { type: String, default: null },
    pdfDataBase64: { type: String, default: null },
    pdfFileName: { type: String, default: null },
    pdfStorageKey: { type: String, default: null },
    lastGeneratedAt: { type: Date, default: null },
    lastGeneratedVersion: { type: Number, default: null },
    lastSentVersion: { type: Number, default: null },
    publicToken: { type: String, default: null, index: true },
    publicViewEnabled: { type: Boolean, default: false },
    publicTokenExpiresAt: { type: Date, default: null },
    publicAccessRevokedAt: { type: Date, default: null },
    publicViewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    preparedByName: { type: String, required: true, trim: true },
    preparedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    collaboratorUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    visibility: { type: String, enum: ["platform_admins", "assigned_only"], default: "platform_admins" },
    sentAt: { type: Date, default: null },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    nextFollowUpDate: { type: Date, default: null, index: true },
    followUpNotes: { type: String, default: "", trim: true },
    lastFollowedUpAt: { type: Date, default: null },
    internalNotes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

proposalSchema.index({ status: 1, updatedAt: -1 });
proposalSchema.index({ schoolName: "text", recipientName: "text", recipientEmail: "text", title: "text" });

export const Proposal: Model<IProposal> =
  (models.Proposal as Model<IProposal>) || model<IProposal>("Proposal", proposalSchema);
