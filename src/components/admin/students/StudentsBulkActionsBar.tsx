"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  X,
  Mail,
  Download,
  Layers,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StudentsBulkActionsBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onAssignClass: () => void;
  onSendMessage: () => void;
  onExportSelected: () => void;
  onChangeStatus: () => void;
  onMarkFeesCleared: () => void;
};

export function StudentsBulkActionsBar({
  selectedCount,
  onClearSelection,
  onAssignClass,
  onSendMessage,
  onExportSelected,
  onChangeStatus,
  onMarkFeesCleared,
}: StudentsBulkActionsBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-40",
        "sm:left-4 sm:right-4 md:left-6 md:right-6 lg:left-[260px] lg:right-6"
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-5xl rounded-2xl border border-(--ws-line)",
          "bg-linear-to-r from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to)",
          "shadow-[var(--ws-shadow)] backdrop-blur-xl",
          "px-4 py-3 md:px-6 md:py-3.5",
          "max-w-full" // Ensure it doesn't exceed viewport
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: count + clear */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary-50">
              <Users className="h-3.5 w-3.5" />
              <span>
                {selectedCount} student{selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-[11px] text-(--ws-fg-60)/80 hover:text-(--ws-fg)"
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
              className="border-primary/40 bg-primary/15 text-[11px] font-medium text-primary-50 hover:bg-primary/30"
              onClick={onAssignClass}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Assign class
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-blue-400/40 bg-blue-500/10 text-[11px] font-medium text-blue-50 hover:bg-blue-500/20"
              onClick={onSendMessage}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Message parents
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500/20"
              onClick={onMarkFeesCleared}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Mark fees cleared
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-(--ws-line-strong) bg-(--ws-fill) text-[11px] font-medium text-(--ws-fg) hover:bg-(--ws-fill-strong)"
              onClick={onExportSelected}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export selected
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="hidden border-(--ws-line) bg-white/0 text-[11px] font-medium text-(--ws-fg-80) hover:bg-(--ws-fill-strong) md:inline-flex"
              onClick={onChangeStatus}
            >
              <span>More</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
