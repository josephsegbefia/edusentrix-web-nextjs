"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StudentsViewToggle } from "./StudentsViewToggle";
import { Filter, Download, Search } from "lucide-react";
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
}: StudentsToolbarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Left: search */}
      <div className="w-full md:max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            ref={searchInputRef ?? undefined}
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by name, ID, admission number, parent..."
            className={cn(
              "pl-8 pr-3 text-xs md:text-sm",
              "border-white/15 bg-black/40 text-foreground shadow-sm shadow-black/30",
              "placeholder:text-muted-foreground/70",
              "focus:border-primary/40 focus:ring-1 focus:ring-primary/60"
            )}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Tip: Press <span className="rounded bg-white/10 px-1 py-0.5">/</span>{" "}
          to focus search
        </p>
      </div>

      {/* Right: filters, view toggle, export */}
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 bg-black/40 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground"
          onClick={onOpenFilters}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Filters
        </Button>

        <StudentsViewToggle value={viewMode} onChange={onViewModeChange} />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exportingAll}
          className="border-white/20 bg-white/5 text-xs text-slate-50 hover:bg-white/10"
          onClick={() => onExportAll?.()}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exportingAll ? "Exporting..." : "Export list"}
        </Button>
      </div>
    </div>
  );
}
