"use client";

import React, { useMemo, useRef, useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { useUploadThing } from "@/lib/uploadthing/react";

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
    /** UploadThing file key (for server-side re-download). */
    uploadKey?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

type DocumentEndpoint =
  | "teacherDocument"
  | "studentRecordDocument"
  | "expenseReceipt"
  | "assignmentAttachment"
  | "submissionAttachment"
  | "noticeAttachment";

function endpointForCategory(category: string): DocumentEndpoint {
  const normalized = (category || "").toLowerCase().trim();

  if (normalized.includes("student")) return "studentRecordDocument";
  if (normalized.includes("teacher")) return "teacherDocument";
  if (normalized.includes("expense") || normalized.includes("receipt")) {
    return "expenseReceipt";
  }
  if (normalized.includes("assignment") || normalized.includes("submission")) {
    return "submissionAttachment";
  }
  if (normalized.includes("notice")) return "noticeAttachment";

  return "teacherDocument";
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
  const uploadErrorMessage = useRef<string | null>(null);
  const endpoint = useMemo(() => endpointForCategory(category), [category]);

  const { startUpload } = useUploadThing(endpoint, {
    onUploadProgress: (progress) => {
      setUploadProgress(Math.min(95, progress));
    },
    onUploadError: (error) => {
      uploadErrorMessage.current = error.message || "Upload failed";
    },
  });

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(0);
      uploadErrorMessage.current = null;

      const result = await startUpload([file], { schoolId: _schoolId });
      const uploaded = result?.[0];

      if (!uploaded) {
        throw new Error(uploadErrorMessage.current || "Upload did not return a file");
      }

      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      const uploadKey = uploaded.serverData?.key || uploaded.key;
      const publicId = uploaded.serverData?.customId || uploadKey;
      const bytes = uploaded.size ?? file.size;
      const format = inferFormat(uploaded.name || file.name, uploaded.type || file.type);
      const mimeType = uploaded.type || file.type;
      const normalizedFormat =
        format && publicId.toLowerCase().endsWith(`.${format.toLowerCase()}`)
          ? undefined
          : format;

      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUploaded({
        publicId,
        url,
        bytes,
        format: normalizedFormat,
        mimeType,
        fileName: uploaded.name || file.name,
        uploadKey,
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
