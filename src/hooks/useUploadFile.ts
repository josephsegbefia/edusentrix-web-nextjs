"use client";

import { useCallback } from "react";
import { buildAvatarUrl } from "@/lib/cloudinary-url";

type UseUploadFileOptions = {
  schoolId: string;
  subjectRole:
    | "students"
    | "teachers"
    | "school_admins"
    | "parents"
    | "staff"
    | "bursars";
};

type UploadResult = {
  url: string;
  publicId: string;
};

/**
 * Hook for uploading images to Cloudinary
 * Extracted from ImageUploader component for reuse
 */
export function useUploadFile({ schoolId, subjectRole }: UseUploadFileOptions) {
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      // 1) Ask server for a Cloudinary signature and folder
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          schoolId,
          subjectRole,
        }),
      });

      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({}));
        throw new Error(j?.error || "Signature failed");
      }
      const sign = await signRes.json();

      // 2) Direct upload to Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", sign.timestamp);
      fd.append("signature", sign.signature);
      fd.append("folder", sign.folder);
      fd.append("unique_filename", "true");
      fd.append("overwrite", "false");

      const upRes = await fetch(sign.uploadUrl, { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Upload failed");
      }
      const data = await upRes.json();

      // 3) Build a transformed display URL (bg removal + white + 1:1 + enhance)
      const publicId: string = data.public_id;
      const displayUrl = buildAvatarUrl(publicId, {
        w: 512,
        h: 512,
        enableBgRemove: true,
      });

      return { url: displayUrl, publicId };
    },
    [schoolId, subjectRole]
  );

  return { upload };
}
