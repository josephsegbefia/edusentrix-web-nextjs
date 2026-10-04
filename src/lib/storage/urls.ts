import { OBJECT_ID_HEX } from "./ids";
import { StorageValidationError } from "./types";

export function getStoredAssetUrl(assetId: string): string {
  if (!OBJECT_ID_HEX.test(assetId)) {
    throw new StorageValidationError("Invalid asset id");
  }
  return `/api/storage/assets/${assetId.toLowerCase()}`;
}
