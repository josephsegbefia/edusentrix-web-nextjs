import {
  softDeleteStoredAssetUrl,
  type StoredAssetDeleteScope,
} from "@/lib/storage/service";
import { parseStoredAssetId } from "@/lib/storage/urls";

export type { StoredAssetDeleteScope };

/** Soft-deletes a stored asset, but only inside the given school and kinds. */
export async function deleteUploadedFile(
  url: string,
  scope: StoredAssetDeleteScope
): Promise<boolean> {
  if (!url) {
    return true;
  }
  if (!parseStoredAssetId(url)) {
    return false;
  }
  return softDeleteStoredAssetUrl(url, null, scope);
}

export async function deleteUploadedFiles(
  urls: string[],
  scope: StoredAssetDeleteScope
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    const ok = await deleteUploadedFile(url, scope);
    if (ok) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return { deleted, failed };
}
