"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { GradesSortBy, GradesSortOrder } from "@/constants/grades";
import type { GradeDTO } from "@/hooks/admin/useGrades";
import { GradeRowActions } from "./GradeRowActions";
import { ArrowUpDown, ChevronUp, ChevronDown, GraduationCap } from "lucide-react";

type GradesTableProps = {
  grades: GradeDTO[];
  sortBy: GradesSortBy;
  sortOrder: GradesSortOrder;
  onSortChange: (column: GradesSortBy) => void;
  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAllVisible: (visibleIds: string[]) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
};

type SortableHeaderProps = {
  label: string;
  column: GradesSortBy;
  sortBy: GradesSortBy;
  sortOrder: GradesSortOrder;
  onSortChange: (column: GradesSortBy) => void;
  align?: "left" | "right" | "center";
};

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSortChange,
  align = "left",
}: SortableHeaderProps) {
  const isActive = sortBy === column;
  const Icon = !isActive
    ? ArrowUpDown
    : sortOrder === "asc"
    ? ChevronUp
    : ChevronDown;

  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      className={cn(
        "group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto"
      )}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground" />
    </button>
  );
}

export function GradesTable({
  grades,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
  onView,
  onEdit,
}: GradesTableProps) {
  const visibleIds = React.useMemo(() => grades.map((g) => g.id), [grades]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.some((id) => selectedIds.includes(id)) &&
    !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    onToggleAllVisible(visibleIds);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
      <table className="min-w-full border-collapse text-xs md:text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground">
            <th className="w-8 px-3 py-2 text-left align-middle">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={handleHeaderCheckboxChange}
                className={cn(
                  "h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                )}
                aria-label="Select all visible grades"
                indeterminate={someVisibleSelected}
              />
            </th>
            <th className="min-w-[180px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Grade"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[90px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Code"
                column="code"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Stage"
                column="stage"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Classes"
                column="classCount"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Students"
                column="studentCount"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[80px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
            </th>
            <th className="w-12 px-3 py-2 text-right align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade) => {
            const isSelected = selectedIds.includes(grade.id);
            const classCount = grade.classCount ?? 0;
            const studentCount = grade.studentCount ?? 0;

            return (
              <tr
                key={grade.id}
                onClick={() => onView?.(grade.id)}
                className={cn(
                  "border-b border-white/5 transition-colors cursor-pointer",
                  "hover:bg-white/5",
                  isSelected && "bg-blue-500/10"
                )}
              >
                <td className="px-3 py-2 align-middle">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleRow(grade.id)}
                    className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                    aria-label={`Select ${grade.name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
                      <GraduationCap className="h-4 w-4 text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">
                        {grade.name}
                      </p>
                      <p className="truncate text-[11px] text-white/60">
                        {grade.code ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/70">
                  {grade.code ?? "—"}
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {grade.stage}
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {classCount}
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {studentCount}
                </td>
                <td className="px-3 py-2 align-middle text-xs">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      grade.isActive &&
                        "bg-blue-500/15 text-blue-100 border border-blue-400/40",
                      !grade.isActive &&
                        "bg-slate-500/20 text-slate-100 border border-slate-400/40"
                    )}
                  >
                    {grade.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <GradeRowActions
                    id={grade.id}
                    onView={onView}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
