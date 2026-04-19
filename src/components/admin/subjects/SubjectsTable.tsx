// src/components/admin/subjects/SubjectsTable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { resolveSubjectVisual } from "@/components/admin/subjects/subject-visuals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shapes,
  MoreHorizontal,
  Pencil,
  School,
  UserPlus,
  Users,
} from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";

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
          "text-xs font-medium text-muted-foreground",
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-white/10 to-white/5">
          <Shapes className="h-8 w-8 text-amber-100/45" />
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
          <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground">
            {onToggleRow && (
              <th className="w-8 px-3 py-2 text-left align-middle">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={handleHeaderCheckboxChange}
                  className={cn(
                    "h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                  )}
                  aria-label="Select all visible subjects"
                  indeterminate={someVisibleSelected}
                />
              </th>
            )}
            <th className="min-w-[220px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Subject"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Classes"
                column="classes"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Teachers"
                column="teachers"
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
          {subjects.map((subject) => {
            const isSelected = selectedIds.includes(subject.id);
            const visual = resolveSubjectVisual(subject);
            const SubjectIcon = visual.icon;

            return (
              <tr
                key={subject.id}
                onClick={() => onView?.(subject.id)}
                className={cn(
                  "border-b border-white/5 transition-colors cursor-pointer",
                  "hover:bg-white/5",
                  isSelected && "bg-blue-500/10"
                )}
              >
                {onToggleRow && (
                  <td className="px-3 py-2 align-middle">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleRow(subject.id)}
                      className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                      aria-label={`Select ${subject.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                        visual.iconShell
                      )}
                    >
                      <SubjectIcon className={cn("h-4 w-4", visual.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">
                        {subject.name}
                      </p>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                          visual.codeBadge
                        )}
                      >
                        {subject.code ?? "No code"}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  <div className="flex items-center gap-1.5">
                    <School className={cn("h-3.5 w-3.5", visual.statIcon)} />
                    <span>{subject.classCount}</span>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  <div className="flex items-center gap-1.5">
                    <Users className={cn("h-3.5 w-3.5", visual.statIcon)} />
                    <span>{subject.teacherCount}</span>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      subject.isActive
                        ? "bg-blue-500/15 text-blue-100 border border-blue-400/40"
                        : "bg-slate-500/20 text-slate-100 border border-slate-400/40"
                    )}
                  >
                    {subject.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right align-middle">
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More actions</span>
                      </Button>
                    </PremiumDropdownMenuTrigger>
                    <PremiumDropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PremiumDropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onView?.(subject.id);
                        }}
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                      >
                        View subject
                      </PremiumDropdownMenuItem>
                      <PremiumDropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(subject.id);
                        }}
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        Edit subject
                      </PremiumDropdownMenuItem>
                      <PremiumDropdownMenuSeparator />
                      <PremiumDropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignToClasses?.(subject.id);
                        }}
                        icon={<School className="h-3.5 w-3.5" />}
                      >
                        Assign to classes
                      </PremiumDropdownMenuItem>
                      <PremiumDropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignTeachers?.(subject.id);
                        }}
                        icon={<UserPlus className="h-3.5 w-3.5" />}
                      >
                        Assign teachers
                      </PremiumDropdownMenuItem>
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
