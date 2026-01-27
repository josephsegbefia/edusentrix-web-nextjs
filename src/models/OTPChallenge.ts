// src/models/OTPChallenge.ts
import { Schema, model, models } from "mongoose";

export type OtpPurpose = "set_password" | "reset_password";

export interface IOtpChallenge {
  email: string; // lower-cased
  purpose: OtpPurpose;
  otpHash: string; // sha256(otp)
  attempts: number; // wrong attempts counter
  createdAt: Date; // for audit
  expiresAt: Date; // TTL
}

const otpChallengeSchema = new Schema<IOtpChallenge>({
  email: { type: String, required: true, lowercase: true, index: true },
  purpose: {
    type: String,
    enum: ["set_password", "reset_password"],
    required: true,
    index: true,
  },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true }, // 10–15 mins window
});

// TTL index (Mongo will auto-delete when expiresAt < now)
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Helpful to look up latest challenge quickly
otpChallengeSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const OTPChallenge =
  models.OTPChallenge ||
  model<IOtpChallenge>("OTPChallenge", otpChallengeSchema);
