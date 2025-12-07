"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { StudentListItem } from "@/types/admin/student";
import { StudentAvatarStatus } from "./StudentAvatarStatus";
import { FeeStatusBadge } from "./FeeStatusBadge";
import { AcademicBadgePill } from "./AcademicBadgePill";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  UserPlus,
  CreditCard,
} from "lucide-react";

type StudentCardProps = {
  student: StudentListItem;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

type FeeTone = "neutral" | "success" | "danger" | "warning" | "info" | "muted";

function getFeeTone(s: StudentListItem): FeeTone {
  if (s.status !== "active") return "muted";

  if ((s.feeStatus === "unknown" || s.feeStatus === "none") && s.isNew) {
    return "info";
  }

  switch (s.feeStatus) {
    case "cleared":
      return "success";
    case "owing":
      return "danger";
    case "partial":
      return "warning";
    case "none":
      return "info";
    case "unknown":
    default:
      return "neutral";
  }
}

const toneBorder: Record<FeeTone, string> = {
  neutral: "border-white/10",
  success: "border-emerald-400/40",
  danger: "border-red-400/40",
  warning: "border-amber-400/40",
  info: "border-blue-400/40",
  muted: "border-slate-500/40",
};

const toneBg: Record<FeeTone, string> = {
  neutral: "from-white/5 via-white/0 to-transparent",
  success: "from-emerald-500/12 via-emerald-500/5 to-transparent",
  danger: "from-red-500/12 via-red-500/5 to-transparent",
  warning: "from-amber-500/12 via-amber-500/5 to-transparent",
  info: "from-blue-500/14 via-blue-500/6 to-transparent",
  muted: "from-slate-600/30 via-slate-700/40 to-transparent",
};

const toneAccent: Record<FeeTone, string> = {
  neutral: "bg-white/10",
  success: "bg-emerald-400/80",
  danger: "bg-red-400/80",
  warning: "bg-amber-400/80",
  info: "bg-blue-400/80",
  muted: "bg-slate-500/80",
};

export function StudentCard({
  student,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentCardProps) {
  const tone = getFeeTone(student);

  const enrolmentLabel = React.useMemo(() => {
    const dateStr = student.enrolledAt ?? student.createdAt;
    if (!dateStr) return "Enrolment date unknown";
    const d = new Date(dateStr);
    return `Enrolled ${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, [student.enrolledAt, student.createdAt]);

  const classLabel = student.classGroupName
    ? `${student.gradeName ?? ""} • ${student.classGroupName}`.trim()
    : student.gradeName ?? "No class assigned";

  const statusLabel = (() => {
    switch (student.status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "withdrawn":
        return "Withdrawn";
      default:
        return student.status;
    }
  })();

  const handleCardClick = () => {
    onView?.(student.id);
  };

  const handleAction =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (fn) fn(student.id);
    };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick();
      }}
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-linear-to-br",
        toneBg[tone],
        toneBorder[tone],
        "px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md",
        "transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-2xl hover:shadow-black/40 cursor-pointer"
      )}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-xl",
          toneAccent[tone]
        )}
      />

      {/* Subtle top glow */}
      <div
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent opacity-60"
        aria-hidden="true"
      />

      {/* Top row: avatar + name + menu */}
      <div className="flex items-start gap-3">
        <StudentAvatarStatus
          fullName={student.fullName}
          photoUrl={student.photoUrl}
          status={student.status}
          size="md"
        />

        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold text-white">
                  {student.fullName}
                </h3>
                {student.isNew && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-50 backdrop-blur">
                    New
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-white/70">{classLabel}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[170px] border border-white/10 bg-slate-900/95 text-xs text-slate-50"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={handleAction(onView)}>
                  View profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAction(onEdit)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAction(onAssignClass)}>
                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                  Assign / change class
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAction(onRecordPayment)}>
                  <CreditCard className="mr-2 h-3.5 w-3.5" />
                  Record payment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAction(onSendMessage)}>
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Message parent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-200">
              {statusLabel}
            </span>
            {student.admissionNumber && (
              <span className="inline-flex items-center rounded-full bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                Adm. No: {student.admissionNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle row: badges */}
      <div className="flex flex-wrap items-center gap-2">
        <FeeStatusBadge
          status={student.feeStatus}
          amountOwed={student.amountOwed}
        />
        <AcademicBadgePill
          badge={student.academicBadge}
          latestAverage={student.lastestAverage}
        />
      </div>

      {/* Bottom row: meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200/80">
        <span>{enrolmentLabel}</span>
        {student.lastestAverage !== null && (
          <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-100">
            Latest average: {student.lastestAverage.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
