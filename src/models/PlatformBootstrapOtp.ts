import { Schema, model, models, type Model } from "mongoose";

export interface IPlatformBootstrapOtp {
  bootstrapKeyFingerprint: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const platformBootstrapOtpSchema = new Schema<IPlatformBootstrapOtp>(
  {
    bootstrapKeyFingerprint: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

platformBootstrapOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
platformBootstrapOtpSchema.index({ bootstrapKeyFingerprint: 1, createdAt: -1 });

export const PlatformBootstrapOtp: Model<IPlatformBootstrapOtp> =
  (models.PlatformBootstrapOtp as Model<IPlatformBootstrapOtp>) ||
  model<IPlatformBootstrapOtp>("PlatformBootstrapOtp", platformBootstrapOtpSchema);
