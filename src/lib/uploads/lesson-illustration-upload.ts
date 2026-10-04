import "server-only";

import { Types } from "mongoose";
import { trackUsage } from "@/lib/billing/trackUsage";
import { createReadyAssetFromBytes } from "@/lib/storage/service";

type UploadResult = {
  url: string;
  key: string;
  size: number;
};

async function trackIllustrationUpload(
  schoolId: Types.ObjectId | string,
  size: number
) {
  try {
    await trackUsage({
      schoolId,
      provider: "storage",
      metricKey: "uploaded_assets",
      quantity: 1,
      unitLabel: "assets",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Lesson illustration stored via R2.",
    });
    await trackUsage({
      schoolId,
      provider: "storage",
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

function storageActor(schoolId: Types.ObjectId | string) {
  return {
    userId: null,
    schoolId: new Types.ObjectId(String(schoolId)),
    roles: ["school_admin" as const],
    isPlatformOperator: true,
  };
}

export async function uploadLessonIllustrationBuffer(input: {
  schoolId: Types.ObjectId | string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<UploadResult> {
  const uploaded = await createReadyAssetFromBytes({
    actor: storageActor(input.schoolId),
    kind: "lesson_illustration",
    fileName: input.fileName,
    mimeType: input.mimeType || "image/png",
    body: input.buffer,
  });
  await trackIllustrationUpload(input.schoolId, uploaded.sizeBytes);
  return {
    url: uploaded.assetUrl,
    key: uploaded.assetId,
    size: uploaded.sizeBytes,
  };
}

export async function uploadLessonIllustrationFromUrl(input: {
  schoolId: Types.ObjectId | string;
  url: string;
  fileName: string;
}): Promise<UploadResult> {
  const response = await fetch(input.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error("Could not download generated illustration");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadLessonIllustrationBuffer({
    schoolId: input.schoolId,
    buffer,
    fileName: input.fileName,
    mimeType: response.headers.get("content-type") || "image/png",
  });
}
