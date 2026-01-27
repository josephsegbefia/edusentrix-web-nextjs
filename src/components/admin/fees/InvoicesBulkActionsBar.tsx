"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Download,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type InvoicesBulkActionsBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onIssue: () => void;
  onCancel: () => void;
  onExportSelected: () => void;
};

export function InvoicesBulkActionsBar({
  selectedCount,
  onClearSelection,
  onIssue,
  onCancel,
  onExportSelected,
}: InvoicesBulkActionsBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-40",
        "md:left-6 md:right-6 lg:left-[260px] lg:right-6"
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-5xl rounded-2xl border border-white/15",
          "bg-linear-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90",
          "shadow-2xl shadow-black/40 backdrop-blur-xl",
          "px-4 py-3 md:px-6 md:py-3.5",
          "max-w-full"
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: count + clear */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary-50">
              <FileText className="h-3.5 w-3.5" />
              <span>
                {selectedCount} invoice{selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300/80 hover:text-slate-50"
            >
              <X className="h-3 w-3" />
              <span>Clear</span>
            </button>
          </div>

          {/* Right: actions */}
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500/20"
              onClick={onIssue}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Issue selected
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-400/40 bg-red-500/10 text-[11px] font-medium text-red-50 hover:bg-red-500/20"
              onClick={onCancel}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Cancel selected
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/5 text-[11px] font-medium text-slate-50 hover:bg-white/10"
              onClick={onExportSelected}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
