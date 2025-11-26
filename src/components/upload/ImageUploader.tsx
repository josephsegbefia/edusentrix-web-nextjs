/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { buildAvatarUrl } from "@/lib/cloudinary-url";

type ImageUploaderProps = {
  schoolId: string;
  /** target subject role (where to store) — NOT the uploader's role */
  subjectRole: "students" | "teachers" | "school_admins" | "parents" | "staff";
  maxSizeMB?: number; // default 5
  onUploaded: (payload: {
    publicId: string;
    url: string; // transformed display URL (bg-removed white, 512x512)
    bytes: number;
    width?: number;
    height?: number;
    format?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

export function ImageUploader({
  schoolId,
  subjectRole,
  maxSizeMB = 5,
  onUploaded,
  onError,
  className,
  label = "Upload avatar",
}: ImageUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleUpload(file: File) {
    try {
      setBusy(true);

      // 1) Ask server for a Cloudinary signature and folder
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
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
      const width: number | undefined = data.width;
      const height: number | undefined = data.height;
      const bytes: number = data.bytes;
      const format: string | undefined = data.format;

      const displayUrl = buildAvatarUrl(publicId, {
        w: 512,
        h: 512,
        enableBgRemove: true,
      });
      setPreview(displayUrl);

      onUploaded({ publicId, url: displayUrl, width, height, bytes, format });
    } catch (e: any) {
      const msg = e?.message || "Upload error";
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <FileDropzone
        label={label}
        accept={["image/jpeg", "image/png", "image/webp"]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="JPG, PNG, WEBP • 1:1 crop with background removed automatically"
      />

      {preview && (
        <div className="mt-4 flex items-center gap-3">
          <div className="size-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-xs text-white/70">
            <div>Preview (transformed)</div>
            <div className="text-white/50">
              Stored as original with dynamic delivery
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
