"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import type { TeachersSortBy, TeachersSortOrder } from "@/constants/teachers";
import { TeacherAvatarStatus } from "./TeacherAvatarStatus";
import { TeacherRowActions } from "./TeacherRowActions";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { TeacherListItemDTO } from "@/types/admin/teacher";
import { Badge } from "@/components/ui/badge";
import { Home, BookOpen } from "lucide-react";

type TeachersTableProps = {
  teachers: TeacherListItemDTO[];
  sortBy: TeachersSortBy;
  sortOrder: TeachersSortOrder;
  onSortChange: (column: TeachersSortBy) => void;

  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAllVisible: (visibleIds: string[]) => void;

  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  isChangingStatus?: boolean;
};

type SortableHeaderProps = {
  label: string;
  column: TeachersSortBy;
  sortBy: TeachersSortBy;
  sortOrder: TeachersSortOrder;
  onSortChange: (column: TeachersSortBy) => void;
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

export function TeachersTable({
  teachers,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
  onActivate,
  onDeactivate,
  onDelete,
  isChangingStatus,
}: TeachersTableProps) {
  const visibleIds = React.useMemo(() => teachers.map((t) => t.id), [teachers]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.some((id) => selectedIds.includes(id)) &&
    !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    onToggleAllVisible(visibleIds);
  };

  const statusLabel = (status: TeacherListItemDTO["status"]) => {
    switch (status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "on_leave":
        return "On Leave";
      case "terminated":
        return "Terminated";
      default:
        return status;
    }
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
                aria-label="Select all visible teachers"
                indeterminate={someVisibleSelected}
              />
            </th>
            <th className="min-w-[180px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Teacher"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[110px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Employee ID
              </span>
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Department
              </span>
            </th>
            <th className="min-w-[160px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Subjects
              </span>
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Homeroom
              </span>
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Hire Date"
                column="hireDate"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="w-12 px-3 py-2 text-right align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => {
            const isSelected = selectedIds.includes(teacher.id);
            const hireDateLabel = teacher.hireDate
              ? new Date(teacher.hireDate).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—";

            return (
              <tr
                key={teacher.id}
                onClick={() => onView?.(teacher.id)}
                className={cn(
                  "border-b border-white/5 transition-colors",
                  "hover:bg-white/5",
                  isSelected && "bg-primary/10"
                )}
              >
                <td className="px-3 py-2 align-middle">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      // do not let row click fire
                      onToggleRow(teacher.id);
                    }}
                    className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                    aria-label={`Select ${teacher.fullName}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <TeacherAvatarStatus
                      fullName={teacher.fullName}
                      firstName={teacher.firstName}
                      lastName={teacher.lastName}
                      photoUrl={teacher.photoUrl}
                      status={teacher.status}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">
                        {teacher.fullName}
                      </p>
                      <p className="truncate text-[11px] text-white/60">
                        {teacher.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/70">
                  {teacher.employeeId ?? "—"}
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {teacher.department ?? "—"}
                </td>
                <td className="px-3 py-2 align-middle">
                  {teacher.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.slice(0, 2).map((s) => (
                        <Badge
                          key={s.id}
                          variant="outline"
                          className="border-white/10 bg-white/5 text-[10px]"
                        >
                          {s.name}
                        </Badge>
                      ))}
                      {teacher.subjects.length > 2 && (
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/5 text-[10px]"
                        >
                          +{teacher.subjects.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/80">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-middle">
                  {teacher.homeroom ? (
                    <Badge
                      variant="outline"
                      className="border-blue-400/30 bg-blue-500/10 text-[10px]"
                    >
                      <Home className="mr-1 h-3 w-3" />
                      {teacher.homeroom.name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/80">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-middle text-xs">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      teacher.status === "active" &&
                        "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40",
                      teacher.status === "inactive" &&
                        "bg-slate-500/20 text-slate-100 border border-slate-400/40",
                      teacher.status === "on_leave" &&
                        "bg-amber-500/15 text-amber-100 border border-amber-400/40",
                      teacher.status === "terminated" &&
                        "bg-red-500/15 text-red-100 border border-red-400/40"
                    )}
                  >
                    {statusLabel(teacher.status)}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {hireDateLabel}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <TeacherRowActions
                    id={teacher.id}
                    status={teacher.status}
                    onView={onView}
                    onEdit={onEdit}
                    onManageAccess={onManageAccess}
                    onSendMessage={onSendMessage}
                    onActivate={onActivate}
                    onDeactivate={onDeactivate}
                    onDelete={onDelete}
                    isChangingStatus={isChangingStatus}
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
