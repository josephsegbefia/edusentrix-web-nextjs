"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useUploadThing } from "@/lib/uploadthing/react";
import { SCHEME_IMPORT_COLUMN_LABELS } from "@/lib/schemes/scheme-import-required-columns";

type SchemeImportDocumentUploaderProps = {
  schoolId: string;
  maxSizeMB?: number;
  onUploaded: (payload: {
    publicId: string;
    url: string;
    bytes: number;
    format?: string;
    mimeType?: string;
    fileName?: string;
    uploadKey?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

function inferFormat(name: string, type?: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext) return ext;
  if (type && type.includes("/")) return type.split("/").pop();
  return undefined;
}

async function validateSchemeImportFile(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/admin/scheme-imports/validate", {
    method: "POST",
    body: formData,
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
  } | null;

  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "This file is not a valid Scheme of Learning import.");
  }
}

export function SchemeImportDocumentUploader({
  schoolId,
  maxSizeMB = 15,
  onUploaded,
  onError,
  className,
  label = "Upload .pdf, .csv, or .xlsx",
}: SchemeImportDocumentUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [validatePhase, setValidatePhase] = useState<string | null>(null);
  const uploadErrorMessage = useRef<string | null>(null);

  const requiredColumnsHint = useMemo(
    () => SCHEME_IMPORT_COLUMN_LABELS.join(" · "),
    [],
  );

  const { startUpload } = useUploadThing("teacherDocument", {
    onUploadProgress: (progress) => {
      setUploadProgress(Math.min(95, progress));
    },
    onUploadError: (error) => {
      const cause =
        error.cause instanceof Error
          ? error.cause.message
          : typeof error.cause === "string"
            ? error.cause
            : null;
      uploadErrorMessage.current =
        error.message === "Failed to run middleware" && cause
          ? cause
          : error.message || "Upload failed";
    },
  });

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(null);
      uploadErrorMessage.current = null;

      setValidatePhase("Checking that this file is a NaCCA/GES Scheme of Learning table…");
      await validateSchemeImportFile(file);
      setValidatePhase(null);

      setUploadProgress(0);
      const result = await startUpload([file], { schoolId });
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
      setTimeout(() => setUploadProgress(null), 500);

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
      setUploadProgress(null);
      setValidatePhase(null);
      const message = error instanceof Error ? error.message : "Upload error";
      onError?.(message);
    } finally {
      setBusy(false);
      setValidatePhase(null);
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
        ]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint={`NaCCA/GES scheme table required: ${requiredColumnsHint}`}
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
      {validatePhase ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <p>{validatePhase}</p>
        </div>
      ) : null}
    </div>
  );
}
