"use client";

import * as React from "react";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing/react";
import type { AdmissionDocumentRequirement } from "@/lib/admissions/types";
import { toast } from "sonner";

export type UploadedDocument = {
  requirementId: string;
  label: string;
  fileUrl: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
};

type PublicDocumentUploaderProps = {
  requirement: AdmissionDocumentRequirement;
  /** Provide either applicantToken (existing app) OR (schoolId + cycleSlug). */
  applicantToken?: string;
  schoolId?: string;
  cycleSlug?: string;
  /** Secure token from admissions “request document” email (exclusive of other modes). */
  supplementalRequestToken?: string;
  /** Secure token from school “request document from parent” email. */
  studentParentDocumentToken?: string;
  value: UploadedDocument | null;
  onChange: (doc: UploadedDocument | null) => void;
  /** When set, the uploader will POST to the tracker doc-attach endpoint. */
  attachToTracker?: boolean;
};

function formatBytes(bytes: number | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PublicDocumentUploader({
  requirement,
  applicantToken,
  schoolId,
  cycleSlug,
  supplementalRequestToken,
  studentParentDocumentToken,
  value,
  onChange,
  attachToTracker = false,
}: PublicDocumentUploaderProps) {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("admissionDocument", {
    onUploadProgress: (p) => setProgress(Math.min(95, p)),
    onUploadError: (err) => toast.error(err.message || "Upload failed"),
  });

  async function handleFile(file: File) {
    if (
      requirement.maxSizeMb &&
      file.size > requirement.maxSizeMb * 1024 * 1024
    ) {
      toast.error(`File too large. Max ${requirement.maxSizeMb} MB.`);
      return;
    }
    if (
      requirement.mimeTypes &&
      requirement.mimeTypes.length > 0 &&
      !requirement.mimeTypes.includes(file.type)
    ) {
      toast.error("Unsupported file type for this requirement.");
      return;
    }

    const uploadInput = supplementalRequestToken
      ? { supplementalRequestToken }
      : studentParentDocumentToken
        ? { studentParentDocumentToken }
        : applicantToken
          ? { applicantToken }
          : { schoolId, cycleSlug };
    if (
      !supplementalRequestToken &&
      !studentParentDocumentToken &&
      !applicantToken &&
      !(schoolId && cycleSlug)
    ) {
      toast.error("Missing upload context.");
      return;
    }

    try {
      setBusy(true);
      setProgress(0);
      const result = await startUpload([file], uploadInput);
      const uploaded = result?.[0];
      if (!uploaded) throw new Error("Upload did not return a file");

      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      const doc: UploadedDocument = {
        requirementId: requirement.id,
        label: requirement.label,
        fileUrl: url,
        fileName: uploaded.name || file.name,
        sizeBytes: uploaded.size ?? file.size,
        mimeType: uploaded.type || file.type,
      };

      if (supplementalRequestToken) {
        const res = await fetch(
          `/api/public/admissions/supplemental/${supplementalRequestToken}/attach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl: doc.fileUrl,
              fileName: doc.fileName,
              sizeBytes: doc.sizeBytes,
              mimeType: doc.mimeType,
            }),
          }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            (json && (json as { error?: string }).error) ||
              "Could not attach document"
          );
        }
      } else if (studentParentDocumentToken) {
        const res = await fetch(
          `/api/public/students/parent-documents/${studentParentDocumentToken}/attach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl: doc.fileUrl,
              fileName: doc.fileName,
              sizeBytes: doc.sizeBytes,
              mimeType: doc.mimeType,
            }),
          }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            (json && (json as { error?: string }).error) ||
              "Could not attach document"
          );
        }
      } else if (attachToTracker && applicantToken) {
        const res = await fetch(
          `/api/public/admissions/applications/${applicantToken}/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(doc),
          }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json && (json as { error?: string }).error) || "Could not attach document");
        }
      }

      setProgress(100);
      setTimeout(() => setProgress(null), 600);
      onChange(doc);
      toast.success(`${requirement.label} uploaded.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast.error(msg);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {requirement.label}
            {requirement.required ? (
              <span className="ml-1 text-rose-500">*</span>
            ) : null}
          </p>
          {requirement.helpText ? (
            <p className="mt-0.5 text-xs text-white/50">
              {requirement.helpText}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">
            {requirement.maxSizeMb ? `Max ${requirement.maxSizeMb} MB` : "No size cap"}
            {requirement.mimeTypes?.length ? ` · ${requirement.mimeTypes.map((m) => m.split("/")[1]).join(", ")}` : ""}
          </p>
        </div>
        {value ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : null}
      </div>

      <div className="mt-3">
        {value ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-white/45" />
              <div className="min-w-0">
                <p className="truncate text-sm text-white">
                  {value.fileName || "Uploaded file"}
                </p>
                <p className="text-[11px] text-white/45">
                  {formatBytes(value.sizeBytes)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={busy}
              className="h-7 w-7 p-0 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Remove uploaded file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70",
              busy && "pointer-events-none opacity-70"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={requirement.mimeTypes?.join(",")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={busy}
            />
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading… {progress != null ? `${progress}%` : ""}</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Click to choose file</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
}
