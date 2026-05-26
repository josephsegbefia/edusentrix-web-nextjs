import { Schema, model, models, Types, type Model } from "mongoose";

export interface ILearnPlatformSettings {
  _id: Types.ObjectId;
  singletonKey: "learn_platform_settings";
  pricePerStudentPerTermMinor: number;
  currency: "GHS";
  allowPlatformGifts: boolean;
  defaultAccessDuration: "term";
  starterPlanBlocked: boolean;
  disabled: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnPlatformSettingsSchema = new Schema<ILearnPlatformSettings>(
  {
    singletonKey: {
      type: String,
      enum: ["learn_platform_settings"],
      default: "learn_platform_settings",
      required: true,
      unique: true,
    },
    pricePerStudentPerTermMinor: {
      type: Number,
      required: true,
      default: 30000,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["GHS"],
      default: "GHS",
      required: true,
    },
    allowPlatformGifts: { type: Boolean, default: true },
    defaultAccessDuration: {
      type: String,
      enum: ["term"],
      default: "term",
      required: true,
    },
    starterPlanBlocked: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const LearnPlatformSettings: Model<ILearnPlatformSettings> =
  (models.LearnPlatformSettings as Model<ILearnPlatformSettings>) ||
  model<ILearnPlatformSettings>(
    "LearnPlatformSettings",
    learnPlatformSettingsSchema
  );
