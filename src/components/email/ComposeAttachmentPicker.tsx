"use client";

import * as React from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComposeAttachment = {
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  contentBase64: string;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

function formatBytes(bytes?: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] || "" : result);
    };
    reader.onerror = () => reject(new Error("Could not read attachment"));
    reader.readAsDataURL(file);
  });
}

export function ComposeAttachmentPicker({
  attachments,
  onChange,
  disabled,
  className,
}: {
  attachments: ComposeAttachment[];
  onChange: (attachments: ComposeAttachment[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    try {
      const next = [...attachments];
      let totalBytes = next.reduce(
        (sum, attachment) => sum + Number(attachment.sizeBytes || 0),
        0,
      );
      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
          break;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(`${file.name} is larger than 8 MB.`);
          continue;
        }
        if (totalBytes + file.size > MAX_TOTAL_BYTES) {
          setError("Attachments can be up to 12 MB total.");
          continue;
        }
        const contentBase64 = await readFileAsBase64(file);
        totalBytes += file.size;
        next.push({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          contentBase64,
        });
      }
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
          className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          Attach files
        </Button>
        <span className="text-xs text-white/40">
          Up to {MAX_ATTACHMENTS} files, 8 MB each, 12 MB total
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-white/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/80">{attachment.name}</p>
                <p className="text-xs text-white/40">
                  {formatBytes(attachment.sizeBytes)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onChange(attachments.filter((_, itemIndex) => itemIndex !== index))
                }
                className="h-8 w-8 p-0 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
