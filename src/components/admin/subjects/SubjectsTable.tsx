// src/components/admin/subjects/SubjectsTable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  School,
  Users,
  ExternalLink,
  Pencil,
  BookOpen,
  UserPlus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type SubjectsSortBy = "name" | "classes" | "teachers" | "createdAt";
export type SubjectsSortOrder = "asc" | "desc";

type SubjectsTableProps = {
  subjects: SubjectDTO[];
  sortBy?: SubjectsSortBy;
  sortOrder?: SubjectsSortOrder;
  onSortChange?: (column: SubjectsSortBy) => void;
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onToggleAllVisible?: (visibleIds: string[]) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignToClasses?: (id: string) => void;
  onAssignTeachers?: (id: string) => void;
};

type SortableHeaderProps = {
  label: string;
  column: SubjectsSortBy;
  sortBy?: SubjectsSortBy;
  sortOrder?: SubjectsSortOrder;
  onSortChange?: (column: SubjectsSortBy) => void;
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

  if (!onSortChange) {
    return (
      <span
        className={cn(
          "text-xs font-medium text-white/60",
          align === "center" && "text-center",
          align === "right" && "text-right"
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      className={cn(
        "group inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto"
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          isActive ? "text-rose-400" : "text-white/40 group-hover:text-white/60"
        )}
      />
    </button>
  );
}

export function SubjectsTable({
  subjects,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds = [],
  onToggleRow,
  onToggleAllVisible,
  onView,
  onEdit,
  onAssignToClasses,
  onAssignTeachers,
}: SubjectsTableProps) {
  const visibleIds = React.useMemo(() => subjects.map((s) => s.id), [subjects]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.some((id) => selectedIds.includes(id)) &&
    !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    onToggleAllVisible?.(visibleIds);
  };

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <BookOpen className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">No subjects found</p>
        <p className="mt-1 text-xs text-white/50">
          Create your first subject to get started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
      <table className="min-w-full border-collapse text-xs md:text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-xs">
            {onToggleRow && (
              <th className="w-8 px-3 py-3 text-left align-middle">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={handleHeaderCheckboxChange}
                  className={cn(
                    "h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-rose-600"
                  )}
                  aria-label="Select all visible subjects"
                  indeterminate={someVisibleSelected}
                />
              </th>
            )}
            <th className="min-w-[200px] px-4 py-3 text-left align-middle">
              <SortableHeader
                label="Subject"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-4 py-3 text-center align-middle">
              <SortableHeader
                label="Classes"
                column="classes"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                align="center"
              />
            </th>
            <th className="min-w-[100px] px-4 py-3 text-center align-middle">
              <SortableHeader
                label="Teachers"
                column="teachers"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                align="center"
              />
            </th>
            <th className="min-w-[100px] px-4 py-3 text-left align-middle">
              <span className="text-xs font-medium text-white/60">Status</span>
            </th>
            <th className="w-12 px-4 py-3 text-right align-middle">
              <span className="text-xs font-medium text-white/60">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => {
            const isSelected = selectedIds.includes(subject.id);

            return (
              <tr
                key={subject.id}
                onClick={() => onView?.(subject.id)}
                className={cn(
                  "border-b border-white/5 transition-colors cursor-pointer",
                  "hover:bg-white/5",
                  isSelected && "bg-rose-500/10"
                )}
              >
                {onToggleRow && (
                  <td className="px-3 py-3 align-middle">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleRow(subject.id)}
                      className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-rose-600"
                      aria-label={`Select ${subject.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-gradient-to-br from-rose-500/20 to-pink-500/20">
                      <BookOpen className="h-5 w-5 text-rose-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{subject.name}</p>
                      {subject.code && (
                        <p className="text-xs text-white/50">Code: {subject.code}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <School className="h-4 w-4 text-rose-400" />
                    <span className="font-medium text-white tabular-nums">
                      {subject.classCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="h-4 w-4 text-rose-400" />
                    <span className="font-medium text-white tabular-nums">
                      {subject.teacherCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                      subject.isActive
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                    )}
                  >
                    {subject.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right align-middle">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[180px] border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onView?.(subject.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(subject.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Subject
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignToClasses?.(subject.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <School className="h-3.5 w-3.5" />
                        Assign to Classes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignTeachers?.(subject.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign Teachers
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
