import { Schema, model, models, type Model, type Types } from "mongoose";

export type ProposalType = "general" | "pilot" | "full_implementation" | "pricing" | "demo_follow_up";
export type ProposalSectionDisplayStyle = "standard" | "highlight" | "cards" | "table" | "callout";

export interface IProposalTemplateSection {
  key: string;
  title: string;
  subtitle?: string | null;
  content: string;
  order: number;
  enabled: boolean;
  displayStyle: ProposalSectionDisplayStyle;
  pageBreakBefore: boolean;
  pageBreakAfter: boolean;
}

export interface IProposalTemplate {
  _id: Types.ObjectId;
  name: string;
  type: ProposalType;
  description?: string | null;
  sections: IProposalTemplateSection[];
  isDefault: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ProposalTemplateSectionSchema = new Schema<IProposalTemplateSection>(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    content: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    enabled: { type: Boolean, default: true },
    displayStyle: {
      type: String,
      enum: ["standard", "highlight", "cards", "table", "callout"],
      default: "standard",
    },
    pageBreakBefore: { type: Boolean, default: false },
    pageBreakAfter: { type: Boolean, default: false },
  },
  { _id: false },
);

const proposalTemplateSchema = new Schema<IProposalTemplate>(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["general", "pilot", "full_implementation", "pricing", "demo_follow_up"],
      required: true,
      index: true,
    },
    description: { type: String, default: "", trim: true },
    sections: { type: [ProposalTemplateSectionSchema], default: [] },
    isDefault: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

proposalTemplateSchema.index({ type: 1, isDefault: 1 });

export const ProposalTemplate: Model<IProposalTemplate> =
  (models.ProposalTemplate as Model<IProposalTemplate>) ||
  model<IProposalTemplate>("ProposalTemplate", proposalTemplateSchema);
