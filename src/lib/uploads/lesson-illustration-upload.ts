import "server-only";

import { UTApi } from "uploadthing/server";
import { trackUsage } from "@/lib/billing/trackUsage";
import type mongoose from "mongoose";

type UploadResult = {
  url: string;
  key: string;
  size: number;
};

function unwrapUtUpload(
  result: { data: { ufsUrl?: string; url?: string; key: string; size: number } | null; error: unknown },
): UploadResult {
  if (result.error || !result.data) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : "UploadThing upload failed.";
    throw new Error(message);
  }
  const url = result.data.ufsUrl || result.data.url;
  if (!url) throw new Error("UploadThing did not return a file URL.");
  return {
    url,
    key: result.data.key,
    size: result.data.size,
  };
}

async function trackIllustrationUpload(
  schoolId: mongoose.Types.ObjectId | string,
  size: number,
) {
  try {
    await trackUsage({
      schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_assets",
      quantity: 1,
      unitLabel: "assets",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Lesson illustration stored via UploadThing.",
    });
    await trackUsage({
      schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_bytes",
      quantity: Math.max(0, size),
      unitLabel: "bytes",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Lesson illustration byte usage.",
    });
  } catch (error) {
    console.error("Lesson illustration upload usage tracking failed:", error);
  }
}

export async function uploadLessonIllustrationBuffer(input: {
  schoolId: mongoose.Types.ObjectId | string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<UploadResult> {
  const utapi = new UTApi();
  const file = new File([input.buffer], input.fileName, {
    type: input.mimeType || "image/png",
  });
  const result = await utapi.uploadFiles(file);
  const uploaded = unwrapUtUpload(result);
  await trackIllustrationUpload(input.schoolId, uploaded.size);
  return uploaded;
}

export async function uploadLessonIllustrationFromUrl(input: {
  schoolId: mongoose.Types.ObjectId | string;
  url: string;
  fileName: string;
}): Promise<UploadResult> {
  const utapi = new UTApi();
  const result = await utapi.uploadFilesFromUrl({
    url: input.url,
    name: input.fileName,
  });
  const uploaded = unwrapUtUpload(result);
  await trackIllustrationUpload(input.schoolId, uploaded.size);
  return uploaded;
}
