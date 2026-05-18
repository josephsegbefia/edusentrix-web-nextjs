import "server-only";

import { UTApi } from "uploadthing/server";
import { isTrustedSchemeImportFileUrl } from "@/lib/schemes/scheme-import-gate";
import { isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";

const MAX_BYTES = 18 * 1024 * 1024;

function extractUtFileKeyFromUrl(fileUrl: string): string | null {
  try {
    const match = new URL(fileUrl).pathname.match(/\/f\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function fetchBuffer(url: string): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number }
> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(120_000),
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not download uploaded file (HTTP ${res.status})`,
        status: res.status === 404 ? 404 : 502,
      };
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) {
      return { ok: false, error: "File is too large", status: 400 };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      return { ok: false, error: "File is too large", status: 400 };
    }
    const buffer = Buffer.from(ab);
    if (buffer.length === 0) {
      return { ok: false, error: "Downloaded file is empty", status: 400 };
    }
    return { ok: true, buffer };
  } catch {
    return { ok: false, error: "Failed to fetch uploaded file", status: 502 };
  }
}

async function resolveUrlViaUploadThing(input: {
  fileUrl: string;
  fileKey?: string | null;
}): Promise<string | null> {
  const utapi = new UTApi();
  const urlKey = extractUtFileKeyFromUrl(input.fileUrl);
  const candidates: Array<{ key: string; keyType?: "fileKey" | "customId" }> = [];
  if (input.fileKey?.trim()) {
    const k = input.fileKey.trim();
    candidates.push({ key: k, keyType: k.includes("/") ? "customId" : "fileKey" });
    if (k !== urlKey && urlKey) {
      candidates.push({ key: urlKey, keyType: "fileKey" });
    }
  } else if (urlKey) {
    candidates.push({ key: urlKey, keyType: "fileKey" });
  }

  for (const candidate of candidates) {
    try {
      const result = await utapi.getFileUrls(candidate.key, {
        keyType: candidate.keyType,
      });
      const resolved = result.data?.[0]?.url;
      if (resolved && isTrustedSchemeImportFileUrl(resolved)) {
        return resolved;
      }
    } catch (e) {
      console.warn("[scheme-import] UploadThing getFileUrls failed:", {
        key: candidate.key,
        keyType: candidate.keyType,
        error: e instanceof Error ? e.message : e,
      });
    }
  }
  return null;
}

export async function downloadSchemeImportFile(input: {
  fileUrl: string;
  fileKey?: string | null;
  expectPdf?: boolean;
}): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number }
> {
  if (!isTrustedSchemeImportFileUrl(input.fileUrl)) {
    return { ok: false, error: "Untrusted file URL", status: 400 };
  }

  let lastError = "Could not download uploaded file";
  let lastStatus = 502;

  const primary = await fetchBuffer(input.fileUrl);
  if (primary.ok) {
    if (input.expectPdf && !isPdfBuffer(primary.buffer)) {
      lastError =
        "Downloaded file is not a valid PDF. The link may be expired or blocked — try uploading again.";
      lastStatus = 400;
    } else {
      return primary;
    }
  } else {
    lastError = primary.error;
    lastStatus = primary.status;
  }

  const resolvedUrl = await resolveUrlViaUploadThing(input);
  if (resolvedUrl && resolvedUrl !== input.fileUrl) {
    const secondary = await fetchBuffer(resolvedUrl);
    if (secondary.ok) {
      if (input.expectPdf && !isPdfBuffer(secondary.buffer)) {
        return {
          ok: false,
          error:
            "Downloaded file is not a valid PDF. Re-upload the document or use CSV/XLSX instead.",
          status: 400,
        };
      }
      return secondary;
    }
    lastError = secondary.error;
    lastStatus = secondary.status;
  }

  return { ok: false, error: lastError, status: lastStatus };
}
