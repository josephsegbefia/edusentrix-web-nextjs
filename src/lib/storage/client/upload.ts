"use client";

import type { StorageAssociation, StorageKind } from "../types";

export type StorageUploadProgress = (percent: number) => void;

export type StorageUploadInput = {
  kind: StorageKind;
  file: File;
  association?: StorageAssociation;
  onProgress?: StorageUploadProgress;
  signal?: AbortSignal;
  presignPath?: string;
  completePath?: string;
  extraPresignBody?: Record<string, unknown>;
};

export type StorageUploadResult = {
  assetId: string;
  assetUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return body ?? {};
}

function uploadError(body: Record<string, unknown>, fallback: string): Error {
  const message = typeof body.error === "string" ? body.error : fallback;
  return new Error(message);
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: StorageUploadProgress,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error("Upload to storage failed"));
    };
    xhr.onerror = () => reject(new Error("Upload to storage failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}

export async function uploadFileToStorage(
  input: StorageUploadInput
): Promise<StorageUploadResult> {
  const presignPath = input.presignPath ?? "/api/storage/uploads/presign";
  const completePath = input.completePath ?? "/api/storage/uploads/complete";

  const presignResponse = await fetch(presignPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      fileName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      association: input.association,
      ...input.extraPresignBody,
    }),
    signal: input.signal,
  });
  const presignBody = await readJson(presignResponse);
  if (!presignResponse.ok || presignBody.success !== true) {
    throw uploadError(presignBody, "Could not start upload");
  }
  const data = (presignBody.data ?? {}) as Record<string, unknown>;
  const uploadUrl = typeof data.uploadUrl === "string" ? data.uploadUrl : "";
  const assetId = typeof data.assetId === "string" ? data.assetId : "";
  const headers =
    data.headers && typeof data.headers === "object"
      ? (data.headers as Record<string, string>)
      : {};
  if (!uploadUrl || !assetId) {
    throw new Error("Could not start upload");
  }

  input.onProgress?.(5);
  await putWithProgress(uploadUrl, input.file, headers, input.onProgress, input.signal);

  const completeResponse = await fetch(completePath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, ...input.extraPresignBody }),
    signal: input.signal,
  });
  const completeBody = await readJson(completeResponse);
  if (!completeResponse.ok || completeBody.success !== true) {
    throw uploadError(completeBody, "Could not finish upload");
  }
  const completed = (completeBody.data ?? {}) as Record<string, unknown>;
  const assetUrl = typeof completed.assetUrl === "string" ? completed.assetUrl : "";
  if (!assetUrl.startsWith("/api/storage/assets/")) {
    throw new Error("Upload did not return an internal asset URL");
  }
  input.onProgress?.(100);
  return {
    assetId: String(completed.assetId ?? assetId),
    assetUrl,
    fileName: String(completed.fileName ?? input.file.name),
    mimeType: String(completed.mimeType ?? input.file.type),
    sizeBytes: Number(completed.sizeBytes ?? input.file.size),
  };
}
