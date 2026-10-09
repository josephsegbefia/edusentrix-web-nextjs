import { OBJECT_ID_HEX } from "./ids";
import { StorageValidationError } from "./types";

export function getStoredAssetUrl(assetId: string): string {
  if (!OBJECT_ID_HEX.test(assetId)) {
    throw new StorageValidationError("Invalid asset id");
  }
  return `/api/storage/assets/${assetId.toLowerCase()}`;
}

export function parseStoredAssetId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const match = trimmed.match(/^(?:https?:\/\/[^/]+)?\/api\/storage\/assets\/([a-fA-F0-9]{24})(?:\?.*)?$/);
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function isAcceptedUploadedFileUrl(value: string): boolean {
  if (parseStoredAssetId(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizePersistedAssetUrl(
  url: string | null | undefined,
  label = "File"
): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) {
    throw new StorageValidationError(`${label} cannot be stored as a data URL`);
  }
  if (!parseStoredAssetId(trimmed)) {
    throw new StorageValidationError(`${label} must use an internal storage URL`);
  }
  return trimmed.split("?")[0] ?? trimmed;
}
