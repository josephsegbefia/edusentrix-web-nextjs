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
  ChevronDown,
} from "lucide-react";
import type { GradesViewMode } from "./GradesViewToggle";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuLabel,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";

export type GradesFilters = {
  stage?: string;
  isActive?: boolean;
};

type GradesToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: GradesViewMode;
  onViewModeChange: (mode: GradesViewMode) => void;
  onOpenFilters: () => void;
  onExportAll?: () => void;
  exportingAll?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  activeFilterCount?: number;
  stageFilter?: string;
  onStageFilterChange?: (stage: string | undefined) => void;
  statusFilter?: "all" | "active" | "inactive";
  onStatusFilterChange?: (status: "all" | "active" | "inactive") => void;
  stages?: string[];
};

export function GradesToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  onExportAll,
  exportingAll,
  searchInputRef,
  activeFilterCount = 0,
  stageFilter,
  onStageFilterChange,
  statusFilter = "all",
  onStatusFilterChange,
  stages = ["Basic", "Lower Primary", "Upper Primary", "JHS", "SHS", "Other"],
}: GradesToolbarProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search input */}
      <div className="relative w-full md:max-w-md">
        <div
          className={cn(
            "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200",
            isFocused
              ? "border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/10"
              : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/8"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
            <Search
              className={cn(
                "h-3.5 w-3.5 transition-colors sm:h-4 sm:w-4",
                isFocused ? "text-blue-400" : "text-white/40"
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
            placeholder="Search by name, code, or stage..."
            className="h-9 flex-1 bg-transparent pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none sm:h-10"
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
          className={cn(
            "group gap-1.5 rounded-xl border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white sm:gap-2 sm:px-4",
            activeFilterCount > 0 &&
              "border-blue-500/30 bg-blue-500/10 text-blue-300"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/30 text-[9px] font-bold text-blue-200">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Stage filter - Premium dropdown */}
        {onStageFilterChange && (
          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 rounded-xl border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white sm:px-4",
                  stageFilter
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : ""
                )}
              >
                <span className="max-w-[100px] truncate">
                  {stageFilter || "All Stages"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent align="end" className="min-w-[160px]">
              <PremiumDropdownMenuLabel className="text-xs text-white/60">
                Filter by Stage
              </PremiumDropdownMenuLabel>
              <PremiumDropdownMenuSeparator className="bg-white/10" />
              <PremiumDropdownMenuCheckboxItem
                checked={!stageFilter}
                onCheckedChange={() => onStageFilterChange(undefined)}
                className="text-xs"
              >
                All Stages
              </PremiumDropdownMenuCheckboxItem>
              <PremiumDropdownMenuSeparator className="bg-white/10" />
              {stages.map((stage) => (
                <PremiumDropdownMenuCheckboxItem
                  key={stage}
                  checked={stageFilter === stage}
                  onCheckedChange={() =>
                    onStageFilterChange(stageFilter === stage ? undefined : stage)
                  }
                  className="text-xs"
                >
                  {stage}
                </PremiumDropdownMenuCheckboxItem>
              ))}
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        )}

        {/* Status filter - Premium dropdown */}
        {onStatusFilterChange && (
          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 rounded-xl border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white sm:px-4",
                  statusFilter !== "all"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : ""
                )}
              >
                <span>
                  {statusFilter === "all"
                    ? "Status"
                    : statusFilter === "active"
                    ? "Active"
                    : "Inactive"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent align="end" className="min-w-[140px]">
              <PremiumDropdownMenuLabel className="text-xs text-white/60">
                Filter by Status
              </PremiumDropdownMenuLabel>
              <PremiumDropdownMenuSeparator className="bg-white/10" />
              <PremiumDropdownMenuCheckboxItem
                checked={statusFilter === "all"}
                onCheckedChange={() => onStatusFilterChange("all")}
                className="text-xs"
              >
                All Statuses
              </PremiumDropdownMenuCheckboxItem>
              <PremiumDropdownMenuCheckboxItem
                checked={statusFilter === "active"}
                onCheckedChange={() => onStatusFilterChange("active")}
                className="text-xs"
              >
                Active Only
              </PremiumDropdownMenuCheckboxItem>
              <PremiumDropdownMenuCheckboxItem
                checked={statusFilter === "inactive"}
                onCheckedChange={() => onStatusFilterChange("inactive")}
                className="text-xs"
              >
                Inactive Only
              </PremiumDropdownMenuCheckboxItem>
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        )}

        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5 sm:p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-3",
              viewMode === "cards"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
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
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
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
          className="group gap-1.5 rounded-xl border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:border-white/15 hover:bg-white/10 hover:text-white sm:gap-2 sm:px-4"
        >
          <Download className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
          <span>{exportingAll ? "Exporting..." : "Export"}</span>
        </Button>
      </div>
    </div>
  );
}
