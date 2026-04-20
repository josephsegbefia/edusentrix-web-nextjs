import { Schema, model, models, type Model } from "mongoose";

export interface IPlatformBootstrapSession {
  sessionTokenHash: string;
  bootstrapKeyFingerprint: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

const platformBootstrapSessionSchema = new Schema<IPlatformBootstrapSession>(
  {
    sessionTokenHash: { type: String, required: true, index: true },
    bootstrapKeyFingerprint: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

platformBootstrapSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PlatformBootstrapSession: Model<IPlatformBootstrapSession> =
  (models.PlatformBootstrapSession as Model<IPlatformBootstrapSession>) ||
  model<IPlatformBootstrapSession>(
    "PlatformBootstrapSession",
    platformBootstrapSessionSchema
  );
