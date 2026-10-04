import { softDeleteStoredAssetUrl } from "@/lib/storage/service";
import { parseStoredAssetId } from "@/lib/storage/urls";

export async function deleteUploadedFile(url: string): Promise<boolean> {
  if (!url) {
    return true;
  }
  if (!parseStoredAssetId(url)) {
    return false;
  }
  return softDeleteStoredAssetUrl(url);
}

export async function deleteUploadedFiles(
  urls: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    const ok = await deleteUploadedFile(url);
    if (ok) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return { deleted, failed };
}
