"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { useToast } from "@/hooks/useToast";
import { uploadFileToStorage } from "@/lib/storage/client/upload";
import type { StorageKind } from "@/lib/storage/types";

type SubjectRole =
  | "students"
  | "teachers"
  | "school_admins"
  | "parents"
  | "staff"
  | "bursars"
  | "schools";

type ImageUploaderProps = {
  schoolId: string;
  /** target subject role (where to store) — NOT the uploader's role */
  subjectRole: SubjectRole;
  /** Override the inferred storage kind (e.g. store products). */
  kind?: StorageKind;
  maxSizeMB?: number; // default 5
  onUploaded: (payload: {
    publicId: string;
    url: string;
    bytes: number;
    width?: number;
    height?: number;
    format?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
  /** Existing image URL to show in the dropzone before a new upload */
  initialPreviewUrl?: string | null;
};

function kindForRole(subjectRole: SubjectRole): StorageKind {
  switch (subjectRole) {
    case "students":
      return "student_avatar";
    case "teachers":
      return "teacher_avatar";
    case "parents":
      return "parent_avatar";
    case "school_admins":
      return "school_admin_avatar";
    case "staff":
      return "staff_avatar";
    case "bursars":
      return "bursar_avatar";
    case "schools":
      return "school_brand_image";
    default:
      return "teacher_avatar";
  }
}

function inferFormat(name: string, type?: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext) {
    return ext;
  }
  if (type && type.includes("/")) {
    return type.split("/").pop();
  }
  return undefined;
}

export function ImageUploader({
  schoolId: _schoolId,
  subjectRole,
  kind,
  maxSizeMB = 5,
  onUploaded,
  onError,
  className,
  label = "Upload avatar",
  initialPreviewUrl,
}: ImageUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    initialPreviewUrl?.trim() || null
  );
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const toast = useToast();

  const storageKind = useMemo(() => kind ?? kindForRole(subjectRole), [kind, subjectRole]);

  useEffect(() => {
    const trimmed = initialPreviewUrl?.trim();
    if (trimmed) {
      setPreview(trimmed);
    }
  }, [initialPreviewUrl]);

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(0);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const uploaded = await uploadFileToStorage({
        kind: storageKind,
        file,
        onProgress: setUploadProgress,
      });

      const format = inferFormat(uploaded.fileName || file.name, uploaded.mimeType || file.type);

      setUploadProgress(100);
      setPreview(uploaded.assetUrl);
      setLocalPreview(null);

      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUploaded({
        publicId: uploaded.assetId,
        url: uploaded.assetUrl,
        bytes: uploaded.sizeBytes,
        format,
      });

      toast.success("Image uploaded successfully", {
        description: "Your image is ready to use.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload error";
      setLocalPreview(null);
      setUploadProgress(null);
      toast.error("Upload failed", {
        description: message,
      });
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const displayPreview = preview || localPreview;

  return (
    <div className={className}>
      <FileDropzone
        label={label}
        accept={["image/jpeg", "image/png", "image/webp"]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="JPG, PNG, WEBP"
        previewImage={displayPreview}
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
    </div>
  );
}
