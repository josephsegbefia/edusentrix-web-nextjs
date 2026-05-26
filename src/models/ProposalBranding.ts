import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IProposalBranding {
  _id: Types.ObjectId;
  brandName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  letterheadLogoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string | null;
  website: string;
  contactEmail: string;
  whatsapp: string;
  address?: string | null;
  footerText?: string | null;
  letterheadEnabled: boolean;
  watermarkEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const proposalBrandingSchema = new Schema<IProposalBranding>(
  {
    brandName: { type: String, required: true, trim: true, default: "EduSentrix" },
    tagline: { type: String, default: "Modern School Management Platform", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    letterheadLogoUrl: { type: String, default: "", trim: true },
    primaryColor: { type: String, required: true, default: "#6D28D9", trim: true },
    secondaryColor: { type: String, required: true, default: "#06B6D4", trim: true },
    accentColor: { type: String, default: "#0EA5E9", trim: true },
    website: { type: String, required: true, default: "https://www.tryedusentrix.app", trim: true },
    contactEmail: { type: String, required: true, default: "hello@tryedusentrix.app", trim: true },
    whatsapp: { type: String, required: true, default: "0504211501", trim: true },
    address: { type: String, default: "", trim: true },
    footerText: {
      type: String,
      default: "EduSentrix - School management made simpler, clearer and smarter.",
      trim: true,
    },
    letterheadEnabled: { type: Boolean, default: true },
    watermarkEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ProposalBranding: Model<IProposalBranding> =
  (models.ProposalBranding as Model<IProposalBranding>) ||
  model<IProposalBranding>("ProposalBranding", proposalBrandingSchema);
