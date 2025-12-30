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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="w-full md:max-w-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            ref={searchInputRef as any}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email…"
            className="pl-8"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Tip: Press <span className="rounded bg-white/10 px-1">/</span> to
          focus
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onOpenFilters} className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>

        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
              viewMode === "table"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-white/5"
            )}
            aria-pressed={viewMode === "table"}
          >
            <Table2 className="h-4 w-4" />
            Table
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
              viewMode === "cards"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-white/5"
            )}
            aria-pressed={viewMode === "cards"}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>

        <Button variant="outline" onClick={onExportAll} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
