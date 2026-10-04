import "server-only";

import { getStoredAssetBytes } from "@/lib/storage/service";
import type { R2Port } from "@/lib/storage/types";
import { parseStoredAssetId } from "@/lib/storage/urls";
import { isTrustedSchemeImportFileUrl } from "@/lib/schemes/scheme-import-gate";
import { isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";
import { StoredAsset } from "@/models/StoredAsset";

const MAX_BYTES = 18 * 1024 * 1024;

export async function downloadSchemeImportFile(input: {
  fileUrl: string;
  fileKey?: string | null;
  schoolId?: string;
  expectPdf?: boolean;
  r2?: R2Port;
}): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number }
> {
  if (!isTrustedSchemeImportFileUrl(input.fileUrl)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }

  const assetId = parseStoredAssetId(input.fileUrl);
  if (!assetId) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }

  const asset = await StoredAsset.findById(assetId);
  if (!asset || asset.status !== "ready") {
    return { ok: false, error: "Uploaded file not found", status: 404 };
  }
  if (input.schoolId && String(asset.schoolId) !== String(input.schoolId)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }
  if (asset.kind !== "scheme_import") {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }

  try {
    const downloaded = await getStoredAssetBytes({
      assetId,
      schoolId: input.schoolId,
      r2: input.r2,
    });
    if (downloaded.buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "File is too large", status: 400 };
    }
    if (input.expectPdf && !isPdfBuffer(downloaded.buffer)) {
      return {
        ok: false,
        error:
          "Downloaded file is not a valid PDF. The link may be expired or blocked — try uploading again.",
        status: 400,
      };
    }
    return { ok: true, buffer: downloaded.buffer };
  } catch {
    return { ok: false, error: "Failed to fetch uploaded file", status: 502 };
  }
}
