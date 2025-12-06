// src/components/admin/students/StudentsToolbar.tsx
"use client";

import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  StudentsViewToggle,
  type StudentsViewMode,
} from "./StudentsViewToggle";

type StudentsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: StudentsViewMode;
  onViewModeChange: (mode: StudentsViewMode) => void;
  onOpenFilters?: () => void;
};

export function StudentsToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
}: StudentsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, admission number, parent..."
          className="pl-9 text-sm"
        />
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center justify-between gap-2 md:justify-end">
        {onOpenFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
          </Button>
        )}
        <StudentsViewToggle value={viewMode} onChange={onViewModeChange} />
      </div>
    </div>
  );
}
