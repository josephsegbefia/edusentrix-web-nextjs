// src/components/admin/classes/ClassesTable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";
import type { ClassesSortBy, ClassesSortOrder } from "@/constants/classes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  Users,
  BookOpen,
  UserCheck,
  UserX,
  ExternalLink,
  Pencil,
  School,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ClassesTableProps = {
  classes: ClassGroupDTO[];
  sortBy: ClassesSortBy;
  sortOrder: ClassesSortOrder;
  onSortChange: (column: ClassesSortBy) => void;
  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAllVisible: (visibleIds: string[]) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignHomeroom?: (id: string) => void;
  onAssignSubjects?: (id: string) => void;
  onAddStudent?: (id: string) => void;
};

type SortableHeaderProps = {
  label: string;
  column: ClassesSortBy;
  sortBy: ClassesSortBy;
  sortOrder: ClassesSortOrder;
  onSortChange: (column: ClassesSortBy) => void;
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
        "group inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto"
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          isActive ? "text-emerald-400" : "text-white/40 group-hover:text-white/60"
        )}
      />
    </button>
  );
}

export function ClassesTable({
  classes,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
  onView,
  onEdit,
  onAssignHomeroom,
  onAssignSubjects,
  onAddStudent,
}: ClassesTableProps) {
  const visibleIds = React.useMemo(() => classes.map((c) => c.id), [classes]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.some((id) => selectedIds.includes(id)) &&
    !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    onToggleAllVisible(visibleIds);
  };

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <School className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">No classes found</p>
        <p className="mt-1 text-xs text-white/50">
          Create your first class to get started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
      <table className="min-w-full border-collapse text-xs md:text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-xs">
            <th className="w-8 px-3 py-3 text-left align-middle">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={handleHeaderCheckboxChange}
                className={cn(
                  "h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-emerald-600"
                )}
                aria-label="Select all visible classes"
                indeterminate={someVisibleSelected}
              />
            </th>
            <th className="min-w-[200px] px-3 py-3 text-left align-middle">
              <SortableHeader
                label="Class"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[180px] px-3 py-3 text-left align-middle">
              <span className="text-xs font-medium text-white/60">
                Homeroom Teacher
              </span>
            </th>
            <th className="min-w-[100px] px-3 py-3 text-center align-middle">
              <SortableHeader
                label="Students"
                column="students"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                align="center"
              />
            </th>
            <th className="min-w-[100px] px-3 py-3 text-center align-middle">
              <SortableHeader
                label="Subjects"
                column="subjects"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                align="center"
              />
            </th>
            <th className="min-w-[100px] px-3 py-3 text-center align-middle">
              <SortableHeader
                label="Teachers"
                column="teachers"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                align="center"
              />
            </th>
            <th className="min-w-[100px] px-3 py-3 text-left align-middle">
              <span className="text-xs font-medium text-white/60">Status</span>
            </th>
            <th className="w-12 px-3 py-3 text-right align-middle">
              <span className="text-xs font-medium text-white/60">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classGroup) => {
            const isSelected = selectedIds.includes(classGroup.id);
            const homeroomInitials = classGroup.homeroomTeacher
              ? `${classGroup.homeroomTeacher.firstName?.charAt(0) || ""}${classGroup.homeroomTeacher.lastName?.charAt(0) || ""}`.toUpperCase() ||
                "HT"
              : null;

            return (
              <tr
                key={classGroup.id}
                onClick={() => onView?.(classGroup.id)}
                className={cn(
                  "border-b border-white/5 transition-colors cursor-pointer",
                  "hover:bg-white/5",
                  isSelected && "bg-emerald-500/10"
                )}
              >
                <td className="px-3 py-3 align-middle">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleRow(classGroup.id)}
                    className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-emerald-600"
                    aria-label={`Select ${classGroup.fullLabel}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                      <School className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{classGroup.fullLabel}</p>
                      <p className="text-xs text-white/50">{classGroup.grade.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle">
                  {classGroup.homeroomTeacher ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 border border-white/20">
                        <AvatarImage
                          src={classGroup.homeroomTeacher.photoUrl || ""}
                          alt={classGroup.homeroomTeacher.fullName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                          {homeroomInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {classGroup.homeroomTeacher.fullName}
                        </p>
                        <p className="text-xs text-white/50">Homeroom</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-white/40 italic">Not assigned</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-white tabular-nums">
                      {classGroup.studentCount}
                    </span>
                    {classGroup.capacity && (
                      <span className="text-white/40">/ {classGroup.capacity}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-white tabular-nums">
                      {classGroup.subjectCount}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-white tabular-nums">
                      {classGroup.teacherCount}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                      classGroup.isActive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                    )}
                  >
                    {classGroup.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-right align-middle">
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
                          onView?.(classGroup.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(classGroup.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Class
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddStudent?.(classGroup.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Add Student
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignHomeroom?.(classGroup.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        {classGroup.homeroomTeacher ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            Change Homeroom
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            Assign Homeroom
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignSubjects?.(classGroup.id);
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Manage Subjects
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
