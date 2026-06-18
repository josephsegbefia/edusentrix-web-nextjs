"use client";

import * as React from "react";
import { Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  duplicateCount: number;
  onClearSelection: () => void;
  onSelectDuplicates: () => void;
  onDeleteSelected: () => void;
  isDeleting?: boolean;
  className?: string;
};

export function TeacherSessionFlashcardsBulkBar({
  selectedCount,
  duplicateCount,
  onClearSelection,
  onSelectDuplicates,
  onDeleteSelected,
  isDeleting,
  className,
}: Props) {
  if (selectedCount === 0 && duplicateCount === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <span className="text-xs font-medium text-fuchsia-100">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </>
        ) : (
          <span className="text-xs text-white/50">Bulk actions</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {duplicateCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSelectDuplicates}
            className="h-8 border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Select {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
          </Button>
        ) : null}
        {selectedCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDeleting}
            onClick={onDeleteSelected}
            className="h-8 border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete selected
          </Button>
        ) : null}
      </div>
    </div>
  );
}
