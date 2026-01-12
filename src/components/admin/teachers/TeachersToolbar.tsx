/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/admin/teachers/TeachersToolbar.tsx
"use client";

import * as React from "react";
import {
  Search,
  LayoutGrid,
  Table2,
  SlidersHorizontal,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeachersViewMode } from "@/constants/teachers";

export function TeachersToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  onExportAll,
  searchInputRef,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: TeachersViewMode;
  onViewModeChange: (v: TeachersViewMode) => void;
  onOpenFilters: () => void;
  onExportAll: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search input */}
      <div className="relative w-full md:max-w-md">
        <div
          className={cn(
            "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200",
            isFocused
              ? "border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/10"
              : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/8"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Search
              className={cn(
                "h-4 w-4 transition-colors",
                isFocused ? "text-indigo-400" : "text-white/40"
              )}
            />
          </div>
          <input
            ref={searchInputRef as any}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search teachers by name, email, or ID..."
            className="h-10 flex-1 bg-transparent pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <div className="mr-3 hidden items-center gap-1 text-[10px] text-white/30 md:flex">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">
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
          className="group gap-2 rounded-xl border-white/10 bg-white/5 px-4 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
          <span>Filters</span>
        </Button>

        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
              viewMode === "table"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            )}
            aria-pressed={viewMode === "table"}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
              viewMode === "cards"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            )}
            aria-pressed={viewMode === "cards"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportAll}
          className="group gap-2 rounded-xl border-white/10 bg-white/5 px-4 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white"
        >
          <Download className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
          <span>Export</span>
        </Button>
      </div>
    </div>
  );
}
