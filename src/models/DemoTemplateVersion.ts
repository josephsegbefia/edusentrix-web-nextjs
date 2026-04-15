import { Schema, model, models, Types, type Model } from "mongoose";

export type DemoTemplateStatus = "active" | "deprecated" | "draft";

export interface IDemoTemplateVersion {
  _id: Types.ObjectId;
  templateKey: string;
  version: number;
  status: DemoTemplateStatus;
  schoolType: string;
  curriculumCode: string;
  seedScriptVersion: string;
  manifestVersion: string;
  /** Expected entity counts for post-seed verification. */
  manifest?: Record<string, number> | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const demoTemplateVersionSchema = new Schema<IDemoTemplateVersion>(
  {
    templateKey: { type: String, required: true, trim: true },
    version: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "deprecated", "draft"],
      default: "draft",
    },
    schoolType: { type: String, required: true, trim: true },
    curriculumCode: { type: String, required: true, trim: true },
    seedScriptVersion: { type: String, required: true, trim: true },
    manifestVersion: { type: String, required: true, trim: true },
    manifest: { type: Schema.Types.Mixed, default: null },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

demoTemplateVersionSchema.index(
  { templateKey: 1, version: 1 },
  { unique: true }
);
demoTemplateVersionSchema.index({ status: 1 });

export const DemoTemplateVersion: Model<IDemoTemplateVersion> =
  (models.DemoTemplateVersion as Model<IDemoTemplateVersion>) ||
  model<IDemoTemplateVersion>(
    "DemoTemplateVersion",
    demoTemplateVersionSchema
  );
