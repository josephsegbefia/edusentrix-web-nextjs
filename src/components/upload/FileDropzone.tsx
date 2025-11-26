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
};

export function FileDropzone({
  accept,
  maxSizeMB,
  onFile,
  disabled,
  className,
  label,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-sm font-medium text-white/90 mb-2">{label}</div>
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
          "relative rounded-2xl border border-white/10 bg-white/5 transition-all cursor-pointer",
          "p-6 md:p-8",
          dragOver && "border-blue-400/50 bg-blue-400/10",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-transparent rounded-2xl" />
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/80">
              <path
                fill="currentColor"
                d="M19 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4h2v4h10v-4h2Zm-6-2l4-4h-3V3h-2v6H9l4 4Z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold">
              Drag & drop or click to upload
            </div>
            <div className="text-xs text-white/60 mt-1">
              {hint ?? `Allowed: ${accept.join(", ")} · Max ${maxSizeMB}MB`}
            </div>
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
      {error && <div className="text-xs text-rose-400 mt-2">{error}</div>}
    </div>
  );
}
