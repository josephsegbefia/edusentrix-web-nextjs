import "server-only";

import mongoose from "mongoose";
import { StoredAsset } from "@/models/StoredAsset";
import {
  isAcceptablePhotoUrl,
  isEduSentrixStorageKey,
  isPhotoObjectName,
} from "@/schemas/photoUrl";
import { StorageValidationError } from "./types";
import { getStoredAssetUrl, parseStoredAssetId } from "./urls";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn a form photo value into the URL we persist.
 * Internal asset paths and legacy http(s) URLs pass through.
 * An R2 storage key or `{uuid}.ext` object name is resolved to
 * `/api/storage/assets/{id}` for a ready asset in the same school.
 */
export async function resolvePersistedPhotoUrl(args: {
  schoolId: mongoose.Types.ObjectId | string;
  photoUrl: string | null | undefined;
}): Promise<string | null> {
  if (args.photoUrl == null) return null;
  const trimmed = args.photoUrl.trim();
  if (!trimmed) return null;
  if (!isAcceptablePhotoUrl(trimmed)) {
    throw new StorageValidationError("Invalid photo URL");
  }

  const assetId = parseStoredAssetId(trimmed);
  if (assetId) return getStoredAssetUrl(assetId);

  if (!isEduSentrixStorageKey(trimmed) && !isPhotoObjectName(trimmed)) {
    return trimmed;
  }

  const schoolId =
    args.schoolId instanceof mongoose.Types.ObjectId
      ? args.schoolId
      : new mongoose.Types.ObjectId(String(args.schoolId));

  const asset = await StoredAsset.findOne(
    isEduSentrixStorageKey(trimmed)
      ? { schoolId, status: "ready", storageKey: trimmed }
      : {
          schoolId,
          status: "ready",
          storageKey: { $regex: new RegExp(`/${escapeRegex(trimmed)}$`) },
        }
  )
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();

  if (!asset?._id) {
    throw new StorageValidationError("Invalid photo URL");
  }

  return getStoredAssetUrl(String(asset._id));
}
