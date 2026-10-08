"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  SlidersHorizontal,
  Download,
  Search,
  X,
  LayoutGrid,
  Table2,
} from "lucide-react";
import type { StudentsViewMode } from "./StudentsViewToggle";

type StudentsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: StudentsViewMode;
  onViewModeChange: (mode: StudentsViewMode) => void;
  onOpenFilters: () => void;
  onExportAll?: () => void;
  exportingAll?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  activeFilterCount?: number;
};

export function StudentsToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  onExportAll,
  exportingAll,
  searchInputRef,
  activeFilterCount = 0,
}: StudentsToolbarProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search input */}
      <div className="relative w-full md:max-w-md">
        <div
          className={cn(
            "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200",
            isFocused
              ? "border-teal-500/50 bg-teal-500/5 shadow-lg shadow-teal-500/10"
              : "border-(--ws-line) bg-(--ws-fill) hover:border-(--ws-line) hover:bg-(--ws-fill-strong)"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
            <Search
              className={cn(
                "h-3.5 w-3.5 transition-colors sm:h-4 sm:w-4",
                isFocused ? "text-teal-400" : "text-(--ws-fg-40)"
              )}
            />
          </div>
          <input
            ref={searchInputRef ?? undefined}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by name, ID, or class..."
            className="h-9 flex-1 bg-transparent pr-3 text-sm text-(--ws-fg) placeholder:text-(--ws-fg-40) focus:outline-none sm:h-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-(--ws-fill-strong) text-(--ws-fg-60) transition-colors hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <div className="mr-3 hidden items-center gap-1 text-[10px] text-(--ws-fg-40) md:flex">
            <kbd className="rounded border border-(--ws-line) bg-(--ws-fill) px-1.5 py-0.5 font-mono">
              /
            </kbd>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {/* Filters button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFilters}
          className={cn(
            "group gap-1.5 rounded-xl border-(--ws-line) bg-(--ws-fill) px-3 text-xs text-(--ws-fg-70) hover:border-(--ws-line) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg) sm:gap-2 sm:px-4",
            activeFilterCount > 0 &&
              "border-teal-500/30 bg-teal-500/10 text-(--ws-teal)"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/30 text-[9px] font-bold text-(--ws-teal)">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-(--ws-line) bg-(--ws-fill) p-0.5 sm:p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-3",
              viewMode === "cards"
                ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm"
                : "text-(--ws-fg-50) hover:text-(--ws-fg-80)"
            )}
            aria-pressed={viewMode === "cards"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-3",
              viewMode === "table"
                ? "bg-(--ws-fill-strong) text-(--ws-fg) shadow-sm"
                : "text-(--ws-fg-50) hover:text-(--ws-fg-80)"
            )}
            aria-pressed={viewMode === "table"}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExportAll?.()}
          disabled={exportingAll}
          className="group gap-1.5 rounded-xl border-(--ws-line) bg-(--ws-fill) px-3 text-xs text-(--ws-fg-70) hover:border-(--ws-line) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg) sm:gap-2 sm:px-4"
        >
          <Download className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
          <span>{exportingAll ? "Exporting..." : "Export"}</span>
        </Button>
      </div>
    </div>
  );
}
