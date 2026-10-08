"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { uploadFileToStorage } from "@/lib/storage/client/upload";
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

  const requiredColumnsHint = useMemo(
    () => SCHEME_IMPORT_COLUMN_LABELS.join(" · "),
    [],
  );

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(null);

      setValidatePhase("Checking that this file is a NaCCA/GES Scheme of Learning table…");
      await validateSchemeImportFile(file);
      setValidatePhase(null);

      setUploadProgress(0);
      const uploaded = await uploadFileToStorage({
        kind: "scheme_import",
        file,
        onProgress: setUploadProgress,
      });

      const format = inferFormat(uploaded.fileName || file.name, uploaded.mimeType || file.type);
      const normalizedFormat =
        format && uploaded.assetId.toLowerCase().endsWith(`.${format.toLowerCase()}`)
          ? undefined
          : format;

      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 500);

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
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <p>{validatePhase}</p>
        </div>
      ) : null}
    </div>
  );
}
