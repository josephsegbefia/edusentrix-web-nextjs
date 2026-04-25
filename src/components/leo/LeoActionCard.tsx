"use client";

import { ArrowRight, FileText } from "lucide-react";
import type { LeoActionPreviewDTO } from "@/lib/leo/types";

type LeoActionCardProps = {
  preview: LeoActionPreviewDTO;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
};

export function LeoActionCard({
  preview,
  onConfirm,
  onCancel,
  isExecuting = false,
}: LeoActionCardProps) {
  const href = typeof preview.preview.href === "string" ? preview.preview.href : null;
  const draftText =
    typeof preview.preview.draftText === "string" ? preview.preview.draftText : null;
  const proposedChange =
    preview.preview.proposedChange &&
    typeof preview.preview.proposedChange === "object" &&
    !Array.isArray(preview.preview.proposedChange)
      ? (preview.preview.proposedChange as Record<string, unknown>)
      : null;
  const impact =
    preview.preview.impact &&
    typeof preview.preview.impact === "object" &&
    !Array.isArray(preview.preview.impact)
      ? (preview.preview.impact as Record<string, unknown>)
      : null;
  const warnings = Array.isArray(preview.preview.warnings)
    ? preview.preview.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const missingFields = Array.isArray(preview.preview.missingFields)
    ? preview.preview.missingFields.filter((field): field is string => typeof field === "string")
    : [];

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50">
      <div className="mb-2 flex items-start gap-2">
        <div className="rounded-xl bg-amber-300/15 p-2">
          {href ? <ArrowRight className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{preview.title}</p>
          <p className="mt-0.5 text-amber-50/65">{preview.description}</p>
        </div>
      </div>

      {href ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/70">
          Destination: <span className="font-medium text-white">{href}</span>
        </div>
      ) : null}

      {draftText ? (
        <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 font-sans text-white/75">
          {draftText}
        </pre>
      ) : null}

      {proposedChange ? (
        <div className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3 text-white/70">
          <p className="font-medium text-white">Proposed change</p>
          {Object.entries(proposedChange).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <span className="capitalize text-white/45">{key.replace(/([A-Z])/g, " $1")}</span>
              <span className="text-right">{String(value)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {impact ? (
        <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-black/20 p-3 text-white/70">
          <p className="font-medium text-white">Impact</p>
          {Object.entries(impact).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <span className="capitalize text-white/45">{key.replace(/([A-Z])/g, " $1")}</span>
              <span className="text-right">{String(value)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-white/65">
          Missing: {missingFields.join(", ")}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-2 space-y-1 rounded-xl border border-orange-300/20 bg-orange-300/10 p-3 text-orange-50/80">
          <p className="font-medium text-orange-50">Warnings</p>
          {warnings.map((warning) => (
            <p key={warning}>- {warning}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isExecuting}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-white/60 hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isExecuting}
          className="rounded-xl bg-amber-300 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-200 disabled:opacity-50"
        >
          {isExecuting ? "Running..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}
