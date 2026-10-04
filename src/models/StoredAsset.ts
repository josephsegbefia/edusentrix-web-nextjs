import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  STORAGE_KINDS,
  STORAGE_PROVIDER,
  STORAGE_STATUSES,
  STORAGE_VISIBILITIES,
  STORAGE_ASSOCIATION_TYPES,
  type StorageAssociationType,
  type StorageKind,
  type StorageProvider,
  type StorageStatus,
  type StorageVisibility,
} from "@/lib/storage/types";

export interface IStoredAssetAssociation {
  type: StorageAssociationType;
  id: Types.ObjectId;
}

export interface IStoredAsset {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  ownerUserId: Types.ObjectId | null;
  uploadedByUserId: Types.ObjectId | null;
  provider: StorageProvider;
  storageKey: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  kind: StorageKind;
  visibility: StorageVisibility;
  status: StorageStatus;
  association: IStoredAssetAssociation | null;
  deletedAt: Date | null;
  purgeAfter: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
  etag: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const storedAssetAssociationSchema = new Schema<IStoredAssetAssociation>(
  {
    type: {
      type: String,
      enum: STORAGE_ASSOCIATION_TYPES,
      required: true,
    },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const storedAssetSchema = new Schema<IStoredAsset>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    provider: {
      type: String,
      enum: [STORAGE_PROVIDER],
      required: true,
      default: STORAGE_PROVIDER,
    },
    storageKey: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    extension: { type: String, required: true, trim: true, lowercase: true },
    mimeType: { type: String, required: true, trim: true, lowercase: true },
    sizeBytes: { type: Number, required: true, default: 0, min: 0 },
    kind: {
      type: String,
      enum: STORAGE_KINDS,
      required: true,
    },
    visibility: {
      type: String,
      enum: STORAGE_VISIBILITIES,
      required: true,
    },
    status: {
      type: String,
      enum: STORAGE_STATUSES,
      required: true,
      default: "pending",
    },
    association: { type: storedAssetAssociationSchema, default: null },
    deletedAt: { type: Date, default: null },
    purgeAfter: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureCode: { type: String, default: null, trim: true },
    etag: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

storedAssetSchema.index({ storageKey: 1 }, { unique: true, name: "unique_stored_asset_storage_key" });
storedAssetSchema.index({ schoolId: 1, status: 1 }, { name: "stored_asset_school_status" });
storedAssetSchema.index(
  { schoolId: 1, kind: 1, createdAt: -1 },
  { name: "stored_asset_school_kind_created" }
);
storedAssetSchema.index(
  { purgeAfter: 1 },
  {
    name: "stored_asset_purge_after",
    partialFilterExpression: { status: "deleted", purgeAfter: { $exists: true } },
  }
);
storedAssetSchema.index(
  { schoolId: 1, "association.type": 1, "association.id": 1 },
  { name: "stored_asset_school_association" }
);

export const StoredAsset: Model<IStoredAsset> =
  (models.StoredAsset as Model<IStoredAsset>) ||
  model<IStoredAsset>("StoredAsset", storedAssetSchema);
