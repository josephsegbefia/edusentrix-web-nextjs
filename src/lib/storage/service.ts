import { Types } from "mongoose";
import { StoredAsset } from "@/models/StoredAsset";
import { canMutateStoredAsset, canReadStoredAsset, isSchoolAdminOrPlatform } from "./access-policy";
import { DEFAULT_SIGNED_URL_TTL_SECONDS, getR2Config, isR2Configured } from "./config";
import { contentDispositionValue, sanitizeDisplayFileName } from "./filename";
import { assertObjectIdHex } from "./ids";
import {
  FOUNDATION_AUTH_POLICIES,
  assertKindAllowsMime,
  getStorageKindDefinition,
  isSafeInlineMime,
  maxBytesForKindMime,
  normalizeMimeType,
  parseStorageKind,
} from "./kinds";
import { buildStorageKey } from "./key-builder";
import { getR2Port } from "./r2";
import {
  StorageAuthorizationError,
  StorageConflictError,
  StorageNotFoundError,
  StorageValidationError,
  type R2Port,
  type StorageActor,
  type StorageAssociation,
  type StorageKind,
} from "./types";
import { getStoredAssetUrl } from "./urls";

export const STORED_ASSET_RECOVERY_DAYS = 30;

export type PresignUploadInput = {
  actor: StorageActor;
  kind: string;
  fileName: string;
  mimeType: string;
  association?: StorageAssociation;
  r2?: R2Port;
};

export type PresignUploadResult = {
  assetId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
  assetUrl: string;
};

export type CompleteUploadInput = {
  actor: StorageActor;
  assetId: string;
  r2?: R2Port;
};

export type CompleteUploadResult = {
  assetId: string;
  status: "ready";
  assetUrl: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};

function assertFoundationKind(kind: StorageKind) {
  const definition = getStorageKindDefinition(kind);
  if (!FOUNDATION_AUTH_POLICIES.includes(definition.authPolicy)) {
    throw new StorageValidationError(
      "This upload kind is not available on the authenticated storage route"
    );
  }
  return definition;
}

function assertKindActor(actor: StorageActor, kind: StorageKind) {
  const definition = assertFoundationKind(kind);
  if (definition.authPolicy === "school_admin_or_platform" && !isSchoolAdminOrPlatform(actor)) {
    throw new StorageAuthorizationError("Only school admins can upload this file");
  }
}

function port(r2?: R2Port): R2Port {
  return r2 ?? getR2Port();
}

function signedTtlSeconds(): number {
  if (isR2Configured()) {
    return getR2Config().signedUrlTtlSeconds;
  }
  const raw = process.env.R2_SIGNED_URL_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  const ttl = Number(raw);
  if (!Number.isFinite(ttl) || ttl < 30 || ttl > 900) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  return ttl;
}

export async function presignUpload(input: PresignUploadInput): Promise<PresignUploadResult> {
  const kind = parseStorageKind(input.kind);
  assertKindActor(input.actor, kind);
  const mimeType = normalizeMimeType(input.mimeType);
  assertKindAllowsMime(kind, mimeType);
  const fileName = sanitizeDisplayFileName(input.fileName);
  const definition = getStorageKindDefinition(kind);
  const schoolId = String(input.actor.schoolId);
  const built = buildStorageKey({
    schoolId,
    kind,
    mimeType,
    association: input.association,
  });

  const asset = await StoredAsset.create({
    schoolId: input.actor.schoolId,
    ownerUserId: input.actor.userId,
    uploadedByUserId: input.actor.userId,
    provider: "r2",
    storageKey: built.storageKey,
    fileName,
    extension: built.extension,
    mimeType,
    sizeBytes: 0,
    kind,
    visibility: definition.defaultVisibility,
    status: "pending",
    association: input.association
      ? {
          type: input.association.type,
          id: new Types.ObjectId(assertObjectIdHex(input.association.id, "association id")),
        }
      : null,
  });

  const signed = await port(input.r2).createPresignedPut({
    key: built.storageKey,
    contentType: mimeType,
    expiresInSeconds: signedTtlSeconds(),
  });

  return {
    assetId: String(asset._id),
    uploadUrl: signed.url,
    headers: signed.headers,
    expiresInSeconds: signed.expiresInSeconds,
    assetUrl: getStoredAssetUrl(String(asset._id)),
  };
}

async function markFailed(
  assetId: string,
  failureCode: string,
  r2: R2Port,
  storageKey: string
) {
  await StoredAsset.updateOne(
    { _id: assetId, status: "pending" },
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        failureCode,
      },
    }
  );
  try {
    await r2.deleteObject(storageKey);
  } catch {
    // Best-effort cleanup of an invalid object.
  }
}

export async function completeUpload(
  input: CompleteUploadInput
): Promise<CompleteUploadResult> {
  const assetId = assertObjectIdHex(input.assetId, "asset id");
  const asset = await StoredAsset.findById(assetId);
  if (!asset) {
    throw new StorageNotFoundError();
  }
  if (!canMutateStoredAsset({ asset, actor: input.actor })) {
    throw new StorageAuthorizationError("Not allowed to complete this upload", 403);
  }

  const r2Client = port(input.r2);
  const head = await r2Client.headObject(asset.storageKey);

  if (asset.status === "ready") {
    if (
      head.exists &&
      normalizeMimeType(head.contentType || "") === asset.mimeType &&
      (head.contentLength ?? asset.sizeBytes) === asset.sizeBytes
    ) {
      return {
        assetId: String(asset._id),
        status: "ready",
        assetUrl: getStoredAssetUrl(String(asset._id)),
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        fileName: asset.fileName,
      };
    }
    throw new StorageConflictError("Asset is already finalized");
  }

  if (asset.status !== "pending") {
    throw new StorageConflictError("Upload is not pending");
  }

  if (!head.exists) {
    await markFailed(assetId, "missing_object", r2Client, asset.storageKey);
    throw new StorageValidationError("Uploaded object was not found");
  }

  const actualMime = normalizeMimeType(head.contentType || "");
  if (!actualMime || !findAllowed(asset.kind, actualMime)) {
    await markFailed(assetId, "mime_mismatch", r2Client, asset.storageKey);
    throw new StorageValidationError("Uploaded file type is not allowed");
  }
  if (actualMime !== asset.mimeType) {
    await markFailed(assetId, "mime_mismatch", r2Client, asset.storageKey);
    throw new StorageValidationError("Uploaded file type does not match the request");
  }

  const sizeBytes = head.contentLength ?? 0;
  const maxBytes = maxBytesForKindMime(asset.kind, actualMime);
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    await markFailed(assetId, "size_exceeded", r2Client, asset.storageKey);
    throw new StorageValidationError("Uploaded file exceeds the allowed size");
  }

  const completed = await StoredAsset.findOneAndUpdate(
    { _id: asset._id, status: "pending" },
    {
      $set: {
        status: "ready",
        sizeBytes,
        etag: head.etag ?? null,
        completedAt: new Date(),
        failedAt: null,
        failureCode: null,
      },
    },
    { new: true }
  );

  if (!completed) {
    const again = await StoredAsset.findById(asset._id);
    if (again?.status === "ready") {
      return {
        assetId: String(again._id),
        status: "ready",
        assetUrl: getStoredAssetUrl(String(again._id)),
        mimeType: again.mimeType,
        sizeBytes: again.sizeBytes,
        fileName: again.fileName,
      };
    }
    throw new StorageConflictError("Upload is not pending");
  }

  return {
    assetId: String(completed._id),
    status: "ready",
    assetUrl: getStoredAssetUrl(String(completed._id)),
    mimeType: completed.mimeType,
    sizeBytes: completed.sizeBytes,
    fileName: completed.fileName,
  };
}

function findAllowed(kind: StorageKind, mimeType: string): boolean {
  try {
    assertKindAllowsMime(kind, mimeType);
    return true;
  } catch {
    return false;
  }
}

export async function grantAssetDownload(input: {
  actor: StorageActor | null;
  assetId: string;
  disposition?: "inline" | "attachment";
  r2?: R2Port;
}): Promise<{ redirectUrl: string; expiresInSeconds: number }> {
  const assetId = assertObjectIdHex(input.assetId, "asset id");
  const asset = await StoredAsset.findById(assetId);
  if (!asset) {
    throw new StorageNotFoundError();
  }

  const decision = canReadStoredAsset({ asset, actor: input.actor });
  if (!decision.allowed) {
    if (decision.reason === "not_ready") {
      throw new StorageNotFoundError();
    }
    throw new StorageAuthorizationError(
      "Not allowed to download this file",
      input.actor ? 403 : 401
    );
  }

  const requested = input.disposition === "inline" ? "inline" : "attachment";
  const mode =
    requested === "inline" && isSafeInlineMime(asset.mimeType) ? "inline" : "attachment";
  const signed = await port(input.r2).createPresignedGet({
    key: asset.storageKey,
    expiresInSeconds: signedTtlSeconds(),
    contentDisposition: contentDispositionValue(asset.fileName, mode),
    contentType: asset.mimeType,
  });
  return { redirectUrl: signed.url, expiresInSeconds: signed.expiresInSeconds };
}

export async function softDeleteAsset(input: {
  actor: StorageActor;
  assetId: string;
}): Promise<{ assetId: string; status: "deleted"; purgeAfter: Date }> {
  const assetId = assertObjectIdHex(input.assetId, "asset id");
  const asset = await StoredAsset.findById(assetId);
  if (!asset) {
    throw new StorageNotFoundError();
  }
  if (!canMutateStoredAsset({ asset, actor: input.actor })) {
    throw new StorageAuthorizationError("Not allowed to delete this file");
  }
  if (asset.status !== "ready") {
    throw new StorageConflictError("Only ready assets can be deleted");
  }

  const deletedAt = new Date();
  const purgeAfter = new Date(
    deletedAt.getTime() + STORED_ASSET_RECOVERY_DAYS * 24 * 60 * 60 * 1000
  );

  const updated = await StoredAsset.findOneAndUpdate(
    { _id: asset._id, status: "ready" },
    { $set: { status: "deleted", deletedAt, purgeAfter } },
    { new: true }
  );
  if (!updated) {
    throw new StorageConflictError("Asset could not be deleted");
  }
  return { assetId: String(updated._id), status: "deleted", purgeAfter };
}

export async function restoreAsset(input: {
  actor: StorageActor;
  assetId: string;
  r2?: R2Port;
}): Promise<{ assetId: string; status: "ready"; assetUrl: string }> {
  const assetId = assertObjectIdHex(input.assetId, "asset id");
  const asset = await StoredAsset.findById(assetId);
  if (!asset) {
    throw new StorageNotFoundError();
  }
  if (!canMutateStoredAsset({ asset, actor: input.actor })) {
    throw new StorageAuthorizationError("Not allowed to restore this file");
  }
  if (asset.status !== "deleted") {
    throw new StorageConflictError("Only deleted assets can be restored");
  }
  if (!asset.purgeAfter || asset.purgeAfter.getTime() <= Date.now()) {
    throw new StorageConflictError("Recovery period has expired");
  }

  const head = await port(input.r2).headObject(asset.storageKey);
  if (!head.exists) {
    throw new StorageNotFoundError("Stored object is no longer available");
  }

  const updated = await StoredAsset.findOneAndUpdate(
    { _id: asset._id, status: "deleted" },
    {
      $set: {
        status: "ready",
        deletedAt: null,
        purgeAfter: null,
      },
    },
    { new: true }
  );
  if (!updated) {
    throw new StorageConflictError("Asset could not be restored");
  }
  return {
    assetId: String(updated._id),
    status: "ready",
    assetUrl: getStoredAssetUrl(String(updated._id)),
  };
}

/**
 * Permanent object purge. Internal/operator use only — not a client route.
 */
export async function purgeAsset(input: {
  assetId: string;
  r2?: R2Port;
}): Promise<{ assetId: string; purged: true }> {
  const assetId = assertObjectIdHex(input.assetId, "asset id");
  const asset = await StoredAsset.findById(assetId);
  if (!asset) {
    throw new StorageNotFoundError();
  }
  if (asset.status !== "deleted") {
    throw new StorageConflictError("Only deleted assets can be purged");
  }
  await port(input.r2).deleteObject(asset.storageKey);
  return { assetId, purged: true };
}
