// src/components/admin/classes/ClassesToolbar.tsx
"use client";

import * as React from "react";
import {
  Search,
  SlidersHorizontal,
  Download,
  X,
  ChevronDown,
  GraduationCap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type GradeOption = {
  id: string;
  name: string;
};

export type TeacherOption = {
  id: string;
  fullName: string;
};

export function ClassesToolbar({
  search,
  onSearchChange,
  gradeFilter,
  onGradeFilterChange,
  grades,
  teacherFilter,
  onTeacherFilterChange,
  teachers,
  statusFilter,
  onStatusFilterChange,
  onExportAll,
  searchInputRef,
  totalCount,
  filteredCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  gradeFilter: string | undefined;
  onGradeFilterChange: (v: string | undefined) => void;
  grades: GradeOption[];
  teacherFilter: string | undefined;
  onTeacherFilterChange: (v: string | undefined) => void;
  teachers: TeacherOption[];
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (v: "all" | "active" | "inactive") => void;
  onExportAll: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  totalCount?: number;
  filteredCount?: number;
}) {
  const [isFocused, setIsFocused] = React.useState(false);

  const selectedGrade = grades.find((g) => g.id === gradeFilter);
  const selectedTeacher = teachers.find((t) => t.id === teacherFilter);

  const hasActiveFilters =
    gradeFilter !== undefined ||
    teacherFilter !== undefined ||
    statusFilter !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Search + Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search input */}
        <div className="relative w-full md:max-w-md">
          <div
            className={cn(
              "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200",
              isFocused
                ? "border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                : "border-white/15 bg-black/40 text-foreground shadow-sm shadow-black/30 hover:border-white/20"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <Search
                className={cn(
                  "h-4 w-4 transition-colors",
                  isFocused ? "text-emerald-400" : "text-white/40"
                )}
              />
            </div>
            <input
              ref={searchInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Search classes by name..."
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
          {/* Grade filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 border-white/15 text-xs transition-all",
                  gradeFilter
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate">
                  {selectedGrade?.name || "All Grades"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[300px] overflow-y-auto border border-white/10 bg-slate-900/95 backdrop-blur-xl"
            >
              <DropdownMenuLabel className="text-xs text-white/60">
                Filter by Grade
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={gradeFilter === undefined}
                onCheckedChange={() => onGradeFilterChange(undefined)}
                className="text-xs"
              >
                All Grades
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/10" />
              {grades.map((grade) => (
                <DropdownMenuCheckboxItem
                  key={grade.id}
                  checked={gradeFilter === grade.id}
                  onCheckedChange={() =>
                    onGradeFilterChange(gradeFilter === grade.id ? undefined : grade.id)
                  }
                  className="text-xs"
                >
                  {grade.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Teacher filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 border-white/15 text-xs transition-all",
                  teacherFilter
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">
                  {selectedTeacher?.fullName || "All Teachers"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[300px] overflow-y-auto border border-white/10 bg-slate-900/95 backdrop-blur-xl"
            >
              <DropdownMenuLabel className="text-xs text-white/60">
                Filter by Teacher
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={teacherFilter === undefined}
                onCheckedChange={() => onTeacherFilterChange(undefined)}
                className="text-xs"
              >
                All Teachers
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/10" />
              {teachers.map((teacher) => (
                <DropdownMenuCheckboxItem
                  key={teacher.id}
                  checked={teacherFilter === teacher.id}
                  onCheckedChange={() =>
                    onTeacherFilterChange(
                      teacherFilter === teacher.id ? undefined : teacher.id
                    )
                  }
                  className="text-xs"
                >
                  {teacher.fullName}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 border-white/15 text-xs transition-all",
                  statusFilter !== "all"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  {statusFilter === "all"
                    ? "Status"
                    : statusFilter === "active"
                    ? "Active"
                    : "Inactive"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border border-white/10 bg-slate-900/95 backdrop-blur-xl"
            >
              <DropdownMenuCheckboxItem
                checked={statusFilter === "all"}
                onCheckedChange={() => onStatusFilterChange("all")}
                className="text-xs"
              >
                All Statuses
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "active"}
                onCheckedChange={() => onStatusFilterChange("active")}
                className="text-xs"
              >
                Active Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "inactive"}
                onCheckedChange={() => onStatusFilterChange("inactive")}
                className="text-xs"
              >
                Inactive Only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onGradeFilterChange(undefined);
                onTeacherFilterChange(undefined);
                onStatusFilterChange("all");
              }}
              className="gap-1.5 text-xs text-white/60 hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportAll}
            className="gap-2 border-white/15 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Filter summary / counts */}
      {(filteredCount !== undefined || hasActiveFilters) && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          {filteredCount !== undefined && totalCount !== undefined && (
            <span>
              Showing{" "}
              <span className="font-medium text-white/70">{filteredCount}</span> of{" "}
              <span className="font-medium text-white/70">{totalCount}</span> classes
            </span>
          )}
          {hasActiveFilters && (
            <>
              <span className="text-white/30">•</span>
              <span className="text-emerald-400/80">Filters active</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
