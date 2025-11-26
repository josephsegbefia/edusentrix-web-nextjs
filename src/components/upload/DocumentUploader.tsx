/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { FileDropzone } from "./FileDropzone";

type DocumentUploaderProps = {
  schoolId: string;
  category: string; // e.g., "finance", "admissions", "exams", "generic"
  maxSizeMB?: number; // default 15
  onUploaded: (payload: {
    publicId: string;
    url: string; // direct raw URL
    bytes: number;
    format?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

export function DocumentUploader({
  schoolId,
  category,
  maxSizeMB = 15,
  onUploaded,
  onError,
  className,
  label = "Upload document",
}: DocumentUploaderProps) {
  const [busy, setBusy] = useState(false);

  async function handleUpload(file: File) {
    try {
      setBusy(true);

      // 1) Sign
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "doc",
          schoolId,
          category,
        }),
      });

      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({}));
        throw new Error(j?.error || "Signature failed");
      }
      const sign = await signRes.json();

      // 2) Upload to Cloudinary (raw)
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

      const publicId: string = data.public_id;
      const bytes: number = data.bytes;
      const format: string | undefined = data.format;

      // Raw files are delivered via /raw/upload; accessible at /raw/upload/<public_id>
      const url = `https://res.cloudinary.com/${sign.cloudName}/raw/upload/${publicId}`;

      onUploaded({ publicId, url, bytes, format });
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
        accept={[
          "application/pdf",
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/jpeg",
          "image/png",
          "image/webp",
        ]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="PDF, CSV, XLS/XLSX, or images • Max 15MB"
      />
    </div>
  );
}
