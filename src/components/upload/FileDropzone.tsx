"use client";

import React, { useCallback, useRef, useState } from "react";
import clsx from "clsx";

type Props = {
  accept: string[];
  maxSizeMB: number;
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  hint?: string;
  previewImage?: string | null;
  uploadProgress?: number | null;
  showProgress?: boolean;
};

export function FileDropzone({
  accept,
  maxSizeMB,
  onFile,
  disabled,
  className,
  label,
  hint,
  previewImage,
  uploadProgress,
  showProgress = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = typeof uploadProgress === "number" ? uploadProgress : null;

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const validate = useCallback(
    (file: File) => {
      const extOk = accept.some((a) => {
        // allow mime type or extension like ".pdf"
        if (a.startsWith("."))
          return file.name.toLowerCase().endsWith(a.toLowerCase());
        return file.type === a || file.type.startsWith(a.replace("/*", "/"));
      });
      if (!extOk) {
        setError("Unsupported file type");
        return false;
      }
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File too large (max ${maxSizeMB} MB)`);
        return false;
      }
      setError(null);
      return true;
    },
    [accept, maxSizeMB]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files.length) return;
      const file = files[0];
      if (!validate(file)) return;
      onFile(file);
    },
    [validate, onFile]
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={clsx("w-full", className)}>
      {label && (
        <div className="mb-2 text-sm font-medium text-(--ws-fg)">{label}</div>
      )}
      <div
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          "relative cursor-pointer rounded-2xl border border-(--ws-line) bg-(--ws-fill) transition-all",
          "p-6 md:p-8",
          dragOver && "border-blue-400/50 bg-blue-400/10",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-(--ws-fill) via-transparent to-transparent" />
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 overflow-hidden rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3">
            {previewImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-12 h-12 object-cover rounded-lg"
                />
                {showProgress && progress !== null && progress < 100 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <span className="text-xs font-semibold text-white">
                      {Math.round(progress)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-(--ws-fg-70)">
                <path
                  fill="currentColor"
                  d="M19 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4h2v4h10v-4h2Zm-6-2l4-4h-3V3h-2v6H9l4 4Z"
                />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-(--ws-fg)">
              {previewImage ? "Image uploaded" : "Drag & drop or click to upload"}
            </div>
            <div className="mt-1 text-xs text-(--ws-fg-70)">
              {showProgress && progress !== null && progress < 100
                ? `Uploading... ${Math.round(progress)}%`
                : previewImage
                ? "Click to replace image"
                : hint ?? `Allowed: ${accept.join(", ")} · Max ${maxSizeMB}MB`}
            </div>
            {showProgress && progress !== null && progress < 100 && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--ws-fill-strong)">
                <div
                  className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>
      {error && <div className="mt-2 text-xs text-(--ws-rose)">{error}</div>}
    </div>
  );
}
