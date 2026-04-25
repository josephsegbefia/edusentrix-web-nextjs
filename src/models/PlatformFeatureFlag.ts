import { Schema, model, models, type Model, type Types } from "mongoose";

export type ForcedMode = "none" | "force_enabled" | "force_disabled";
export type FlagDefaultState = "enabled" | "disabled";

export interface IPlatformFeatureFlag {
  _id: Types.ObjectId;
  key: string;
  label: string;
  description?: string | null;
  defaultState: FlagDefaultState;
  forcedMode: ForcedMode;
  allowSchoolOverride: boolean;
  allowSchoolSelfService: boolean;
  entitlementKey?: string | null;
  rolloutNotes?: string | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformFeatureFlagSchema = new Schema<IPlatformFeatureFlag>(
  {
    key: { type: String, required: true, trim: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    defaultState: {
      type: String,
      enum: ["enabled", "disabled"] satisfies FlagDefaultState[],
      default: "disabled",
    },
    forcedMode: {
      type: String,
      enum: ["none", "force_enabled", "force_disabled"] satisfies ForcedMode[],
      default: "none",
    },
    allowSchoolOverride: { type: Boolean, default: true },
    allowSchoolSelfService: { type: Boolean, default: false },
    entitlementKey: { type: String, default: "ai_leo_copilot" },
    rolloutNotes: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const PlatformFeatureFlag: Model<IPlatformFeatureFlag> =
  (models.PlatformFeatureFlag as Model<IPlatformFeatureFlag>) ||
  model<IPlatformFeatureFlag>("PlatformFeatureFlag", platformFeatureFlagSchema);
