/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { buildAvatarUrl } from "@/lib/cloudinary-url";
import { useToast } from "@/hooks/useToast";

type ImageUploaderProps = {
  schoolId: string;
  /** target subject role (where to store) — NOT the uploader's role */
  subjectRole:
    | "students"
    | "teachers"
    | "school_admins"
    | "parents"
    | "staff"
    | "bursars";
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const toast = useToast();

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(0);

      // Create local preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

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
        throw new Error(j?.error || "Failed to get upload signature");
      }
      const sign = await signRes.json();
      setUploadProgress(10);

      // 2) Direct upload to Cloudinary with progress tracking
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", sign.timestamp);
      fd.append("signature", sign.signature);
      fd.append("folder", sign.folder);
      fd.append("unique_filename", "true");
      fd.append("overwrite", "false");

      // Use XMLHttpRequest for progress tracking
      const uploadPromise = new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            // Progress from 10% to 90% (signature already done)
            const progress = 10 + (e.loaded / e.total) * 80;
            setUploadProgress(Math.min(progress, 90));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error("Invalid response from server"));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error?.error?.message || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });

        xhr.open("POST", sign.uploadUrl);
        xhr.send(fd);
      });

      const data = await uploadPromise;
      setUploadProgress(95);

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

      setUploadProgress(100);
      setPreview(displayUrl);
      setLocalPreview(null); // Clear local preview once we have the processed one

      // Small delay to show 100% before hiding progress
      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUploaded({ publicId, url: displayUrl, width, height, bytes, format });
      toast.success("Image uploaded successfully", {
        description: "Your image has been processed and is ready to use.",
      });
    } catch (e: any) {
      const msg = e?.message || "Upload error";
      setLocalPreview(null);
      setUploadProgress(null);
      toast.error("Upload failed", {
        description: msg,
      });
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  // Use processed preview if available, otherwise use local preview
  const displayPreview = preview || localPreview;

  return (
    <div className={className}>
      <FileDropzone
        label={label}
        accept={["image/jpeg", "image/png", "image/webp"]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="JPG, PNG, WEBP • 1:1 crop with background removed automatically"
        previewImage={displayPreview}
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
    </div>
  );
}
