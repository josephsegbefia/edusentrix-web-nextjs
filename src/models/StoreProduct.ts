import { Schema, model, models, Types, type Model } from "mongoose";

export interface IStoreProduct {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  description?: string | null;
  /** Price in minor units (e.g. pesewas). */
  priceMinor: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const storeProductSchema = new Schema<IStoreProduct>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "GHS", trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    imageUrl: { type: String, default: null },
  },
  { timestamps: true }
);

storeProductSchema.index({ schoolId: 1, isActive: 1, sortOrder: 1 });

export const StoreProduct: Model<IStoreProduct> =
  (models.StoreProduct as Model<IStoreProduct>) ||
  model<IStoreProduct>("StoreProduct", storeProductSchema);
