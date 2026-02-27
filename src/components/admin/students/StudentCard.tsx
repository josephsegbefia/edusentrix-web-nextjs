"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { StudentListItem } from "@/types/admin/student";
import { StudentAvatarStatus } from "./StudentAvatarStatus";
import { FeeStatusBadge } from "./FeeStatusBadge";
import { AcademicBadgePill } from "./AcademicBadgePill";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  UserPlus,
  CreditCard,
  ExternalLink,
  Calendar,
  GraduationCap,
} from "lucide-react";

type StudentCardProps = {
  student: StudentListItem;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

type StatusTone = "teal" | "rose" | "amber" | "slate" | "violet";

function getStatusTone(s: StudentListItem): StatusTone {
  if (s.status === "graduated") return "violet";
  if (s.status !== "active") return "slate";

  switch (s.feeStatus) {
    case "cleared":
      return "teal";
    case "owing":
      return "rose";
    case "partial":
      return "amber";
    default:
      return "teal";
  }
}

const toneConfig: Record<
  StatusTone,
  {
    border: string;
    bg: string;
    glow: string;
    accent: string;
    badge: string;
  }
> = {
  teal: {
    border: "border-teal-500/30",
    bg: "from-teal-500/10 via-teal-500/5 to-transparent",
    glow: "bg-teal-500/20",
    accent: "bg-teal-500",
    badge: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    glow: "bg-rose-500/20",
    accent: "bg-rose-500",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    glow: "bg-amber-500/20",
    accent: "bg-amber-500",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  slate: {
    border: "border-slate-500/30",
    bg: "from-slate-600/20 via-slate-700/15 to-transparent",
    glow: "bg-slate-500/20",
    accent: "bg-slate-500",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "from-violet-500/10 via-violet-500/5 to-transparent",
    glow: "bg-violet-500/20",
    accent: "bg-violet-500",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
};

export function StudentCard({
  student,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentCardProps) {
  const tone = getStatusTone(student);
  const config = toneConfig[tone];

  const enrolmentLabel = React.useMemo(() => {
    const dateStr = student.enrolledAt ?? student.createdAt;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
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
      case "graduated":
        return "Alumni";
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
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-linear-to-br backdrop-blur-xl",
        config.bg,
        config.border,
        "shadow-xl shadow-black/30 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 cursor-pointer"
      )}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300",
          config.glow,
          "opacity-0 group-hover:opacity-100"
        )}
        aria-hidden="true"
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      {/* Accent bar */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1",
          config.accent
        )}
      />

      {/* Card content */}
      <div className="relative z-10 flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        {/* Header: Avatar + Name + Menu */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="relative">
            <StudentAvatarStatus
              fullName={student.fullName}
              photoUrl={student.photoUrl}
              status={student.status}
              size="md"
            />
            {student.isNew && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-teal-500 text-[8px] font-bold text-white">
                N
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-sm font-semibold text-white">
                  {student.fullName}
                </h3>
                <p className="truncate text-xs text-white/50">{classLabel}</p>
              </div>

              <PremiumDropdownMenu>
                <PremiumDropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </PremiumDropdownMenuTrigger>
                <PremiumDropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onView)}
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                  >
                    View profile
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onEdit)}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit details
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuSeparator />
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onAssignClass)}
                    icon={<UserPlus className="h-3.5 w-3.5" />}
                  >
                    Assign / change class
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onRecordPayment)}
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                  >
                    Record payment
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onSendMessage)}
                    icon={<Mail className="h-3.5 w-3.5" />}
                  >
                    Message parent
                  </PremiumDropdownMenuItem>
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
            </div>

            {/* Status + ID badges */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  config.badge
                )}
              >
                {statusLabel}
              </span>
              {student.admissionNumber && (
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                  {student.admissionNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap items-center gap-2">
          <FeeStatusBadge
            status={student.feeStatus}
            amountOwed={student.amountOwed}
          />
          <AcademicBadgePill
            badge={student.academicBadge}
            latestAverage={student.latestAverage}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/5 bg-white/2 px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <Calendar className="h-3 w-3" />
          <span>
            {enrolmentLabel ? `Enrolled ${enrolmentLabel}` : "Enrollment date unknown"}
          </span>
        </div>
        {student.latestAverage !== null && (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3 text-white/40" />
            <span className="text-[10px] font-medium text-white/60">
              {student.latestAverage.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
