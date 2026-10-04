"use client";

import React, { useMemo, useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { uploadFileToStorage } from "@/lib/storage/client/upload";
import type { StorageKind } from "@/lib/storage/types";

type DocumentUploaderProps = {
  schoolId: string;
  category: string; // e.g., "finance", "admissions", "exams", "generic"
  maxSizeMB?: number; // default 15
  onUploaded: (payload: {
    publicId: string;
    url: string;
    bytes: number;
    format?: string;
    mimeType?: string;
    /** Original client file name (for imports and filenames). */
    fileName?: string;
    uploadKey?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

function kindForCategory(category: string): StorageKind {
  const normalized = (category || "").toLowerCase().trim();

  if (normalized.includes("student")) return "student_record_document";
  if (normalized.includes("teacher")) return "teacher_document";
  if (normalized.includes("expense") || normalized.includes("receipt")) {
    return "expense_receipt";
  }
  if (normalized.includes("submission") || normalized.includes("assignment")) {
    return "submission_attachment";
  }
  if (normalized.includes("notice")) return "notice_attachment";

  return "teacher_document";
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

export function DocumentUploader({
  schoolId: _schoolId,
  category,
  maxSizeMB = 15,
  onUploaded,
  onError,
  className,
  label = "Upload document",
}: DocumentUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const kind = useMemo(() => kindForCategory(category), [category]);

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(0);

      const uploaded = await uploadFileToStorage({
        kind,
        file,
        onProgress: setUploadProgress,
      });

      const format = inferFormat(uploaded.fileName || file.name, uploaded.mimeType || file.type);
      const normalizedFormat =
        format && uploaded.assetId.toLowerCase().endsWith(`.${format.toLowerCase()}`)
          ? undefined
          : format;

      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUploaded({
        publicId: uploaded.assetId,
        url: uploaded.assetUrl,
        bytes: uploaded.sizeBytes,
        format: normalizedFormat,
        mimeType: uploaded.mimeType,
        fileName: uploaded.fileName || file.name,
        uploadKey: uploaded.assetId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload error";
      setUploadProgress(null);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <FileDropzone
        label={label}
        accept={[
          "application/pdf",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/jpeg",
          "image/png",
          "image/webp",
        ]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="PDF, video, CSV, XLS/XLSX, PPT/PPTX, DOC/DOCX, or images"
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
    </div>
  );
}
