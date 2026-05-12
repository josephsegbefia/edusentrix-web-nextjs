import { Schema, model, models, Types, type Model } from "mongoose";

export interface IParentDeviceToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  expoPushToken: string;
  platform: "ios" | "android" | "web";
  deviceName?: string | null;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parentDeviceTokenSchema = new Schema<IParentDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    expoPushToken: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["ios", "android", "web"], required: true },
    deviceName: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

parentDeviceTokenSchema.index({ userId: 1, expoPushToken: 1 }, { unique: true });
parentDeviceTokenSchema.index({ schoolId: 1, isActive: 1, lastSeenAt: -1 });

export const ParentDeviceToken: Model<IParentDeviceToken> =
  (models.ParentDeviceToken as Model<IParentDeviceToken>) ||
  model<IParentDeviceToken>("ParentDeviceToken", parentDeviceTokenSchema);
