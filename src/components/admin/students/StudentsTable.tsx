"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import type { StudentsSortBy, StudentsSortOrder } from "@/constants/students";
import { StudentAvatarStatus } from "./StudentAvatarStatus";
import { FeeStatusBadge } from "./FeeStatusBadge";
import { AcademicBadgePill } from "./AcademicBadgePill";
import { StudentRowActions } from "./StudentRowActions";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { StudentListItem } from "@/types/admin/student";

type StudentsTableProps = {
  students: StudentListItem[];
  sortBy: StudentsSortBy;
  sortOrder: StudentsSortOrder;
  onSortChange: (column: StudentsSortBy) => void;

  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAllVisible: (visibleIds: string[]) => void;

  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

type SortableHeaderProps = {
  label: string;
  column: StudentsSortBy;
  sortBy: StudentsSortBy;
  sortOrder: StudentsSortOrder;
  onSortChange: (column: StudentsSortBy) => void;
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

export function StudentsTable({
  students,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentsTableProps) {
  const visibleIds = React.useMemo(() => students.map((s) => s.id), [students]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.some((id) => selectedIds.includes(id)) &&
    !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    onToggleAllVisible(visibleIds);
  };

  const statusLabel = (status: StudentListItem["status"]) => {
    switch (status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "withdrawn":
        return "Withdrawn";
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
                aria-label="Select all visible students"
                indeterminate={someVisibleSelected}
              />
            </th>
            <th className="min-w-[180px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Student"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[110px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Admission No
              </span>
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Class"
                column="class"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[160px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Fee status"
                column="feeStatus"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Academic"
                column="academic"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </th>
            <th className="min-w-[100px] px-3 py-2 text-left align-middle">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
            </th>
            <th className="min-w-[140px] px-3 py-2 text-left align-middle">
              <SortableHeader
                label="Enrolment"
                column="enrollmentDate"
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
          {students.map((student) => {
            const isSelected = selectedIds.includes(student.id);
            const enrolDateStr = student.enrolledAt ?? student.createdAt;
            const enrolLabel = enrolDateStr
              ? new Date(enrolDateStr).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—";

            const classLabel = student.classGroupName
              ? `${student.gradeName ?? ""} • ${student.classGroupName}`.trim()
              : student.gradeName ?? "No class";

            return (
              <tr
                key={student.id}
                onClick={() => onView?.(student.id)}
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
                      onToggleRow(student.id);
                    }}
                    className="h-4 w-4 border-white/30 bg-slate-900/80 data-[state=checked]:bg-primary"
                    aria-label={`Select ${student.fullName}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <StudentAvatarStatus
                      fullName={student.fullName}
                      photoUrl={student.photoUrl}
                      status={student.status}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">
                        {student.fullName}
                      </p>
                      <p className="truncate text-[11px] text-white/60">
                        {classLabel}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/70">
                  {student.admissionNumber ?? "—"}
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {classLabel}
                </td>
                <td className="px-3 py-2 align-middle">
                  <FeeStatusBadge
                    status={student.feeStatus}
                    amountOwed={student.amountOwed}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <AcademicBadgePill
                    badge={student.academicBadge}
                    latestAverage={student.latestAverage}
                  />
                </td>
                <td className="px-3 py-2 align-middle text-xs">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      student.status === "active" &&
                        "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40",
                      student.status === "inactive" &&
                        "bg-slate-500/20 text-slate-100 border border-slate-400/40",
                      student.status === "withdrawn" &&
                        "bg-red-500/15 text-red-100 border border-red-400/40"
                    )}
                  >
                    {statusLabel(student.status)}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-white/80">
                  {enrolLabel}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <StudentRowActions
                    id={student.id}
                    onView={onView}
                    onEdit={onEdit}
                    onAssignClass={onAssignClass}
                    onRecordPayment={onRecordPayment}
                    onSendMessage={onSendMessage}
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
