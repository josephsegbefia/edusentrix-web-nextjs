import { Schema, model, models, Types, type Model } from "mongoose";
import type { LeoCitation, LeoToolKey } from "@/lib/leo/types";

export interface ILeoResponseCache {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  cacheKey: string;
  toolKey: LeoToolKey;
  route?: string | null;
  contentText: string;
  citations: LeoCitation[];
  toolsUsed: LeoToolKey[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leoResponseCacheSchema = new Schema<ILeoResponseCache>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    cacheKey: {
      type: String,
      required: true,
      index: true,
    },
    toolKey: {
      type: String,
      required: true,
      index: true,
    },
    route: { type: String, default: null, index: true },
    contentText: { type: String, required: true },
    citations: { type: Schema.Types.Mixed, default: [] },
    toolsUsed: { type: [String], default: [] },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

leoResponseCacheSchema.index(
  { schoolId: 1, cacheKey: 1 },
  { unique: true, name: "unique_leo_response_cache_key" }
);
leoResponseCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LeoResponseCache: Model<ILeoResponseCache> =
  (models.LeoResponseCache as Model<ILeoResponseCache>) ||
  model<ILeoResponseCache>("LeoResponseCache", leoResponseCacheSchema);
