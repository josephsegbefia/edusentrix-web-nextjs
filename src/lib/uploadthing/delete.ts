import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/f\/([^/]+)$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function deleteUploadThingFile(keyOrUrl: string): Promise<boolean> {
  if (!keyOrUrl) {
    return true;
  }

  try {
    const key = keyOrUrl.startsWith("http")
      ? extractKeyFromUrl(keyOrUrl)
      : keyOrUrl;

    if (!key) {
      return false;
    }

    await utapi.deleteFiles(key);
    return true;
  } catch (error) {
    console.error("Failed to delete UploadThing file:", error);
    return false;
  }
}

export async function deleteUploadThingFiles(
  keysOrUrls: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const keyOrUrl of keysOrUrls) {
    const ok = await deleteUploadThingFile(keyOrUrl);
    if (ok) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return { deleted, failed };
}
