"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TeacherListItemDTO } from "@/types/admin/teacher";
import { TeacherAvatarStatus } from "./TeacherAvatarStatus";
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
  UserCog,
  Home,
  BookOpen,
} from "lucide-react";

type TeacherCardProps = {
  teacher: TeacherListItemDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
};

type StatusTone = "neutral" | "success" | "danger" | "warning" | "muted";

function getStatusTone(t: TeacherListItemDTO): StatusTone {
  switch (t.status) {
    case "active":
      return "success";
    case "on_leave":
      return "warning";
    case "terminated":
      return "danger";
    case "inactive":
    default:
      return "muted";
  }
}

const toneBorder: Record<StatusTone, string> = {
  neutral: "border-white/10",
  success: "border-emerald-400/40",
  danger: "border-red-400/40",
  warning: "border-amber-400/40",
  muted: "border-slate-500/40",
};

const toneBg: Record<StatusTone, string> = {
  neutral: "from-white/5 via-white/0 to-transparent",
  success: "from-emerald-500/12 via-emerald-500/5 to-transparent",
  danger: "from-red-500/12 via-red-500/5 to-transparent",
  warning: "from-amber-500/12 via-amber-500/5 to-transparent",
  muted: "from-slate-600/30 via-slate-700/40 to-transparent",
};

const toneAccent: Record<StatusTone, string> = {
  neutral: "bg-white/10",
  success: "bg-emerald-400/80",
  danger: "bg-red-400/80",
  warning: "bg-amber-400/80",
  muted: "bg-slate-500/80",
};

export function TeacherCard({
  teacher,
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
}: TeacherCardProps) {
  const tone = getStatusTone(teacher);

  const hireDateLabel = React.useMemo(() => {
    if (!teacher.hireDate) return "Hire date unknown";
    const d = new Date(teacher.hireDate);
    return `Hired ${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, [teacher.hireDate]);

  const statusLabel = (() => {
    switch (teacher.status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "on_leave":
        return "On Leave";
      case "terminated":
        return "Terminated";
      default:
        return teacher.status;
    }
  })();

  const handleCardClick = () => {
    onView?.(teacher.id);
  };

  const handleAction =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (fn) fn(teacher.id);
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
        <TeacherAvatarStatus
          fullName={teacher.fullName}
          firstName={teacher.firstName}
          lastName={teacher.lastName}
          photoUrl={teacher.photoUrl}
          status={teacher.status}
          size="md"
        />

        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold text-white">
                  {teacher.fullName}
                </h3>
                {teacher.isNew && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-50 backdrop-blur">
                    New
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-white/70">
                {teacher.email ?? "No email"}
              </p>
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
                <DropdownMenuItem onClick={handleAction(onManageAccess)}>
                  <UserCog className="mr-2 h-3.5 w-3.5" />
                  Manage access
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAction(onSendMessage)}>
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Send message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-200">
              {statusLabel}
            </span>
            {teacher.employeeId && (
              <span className="inline-flex items-center rounded-full bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                ID: {teacher.employeeId}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle row: badges */}
      <div className="flex flex-wrap items-center gap-2">
        {teacher.homeroom && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] text-blue-100">
            <Home className="h-3 w-3" />
            {teacher.homeroom.name}
          </span>
        )}
        {teacher.department && (
          <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] text-purple-100">
            {teacher.department}
          </span>
        )}
      </div>

      {/* Subjects */}
      {teacher.subjects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-white/60" />
          <div className="flex flex-wrap gap-1">
            {teacher.subjects.slice(0, 3).map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80"
              >
                {s.name}
              </span>
            ))}
            {teacher.subjects.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80">
                +{teacher.subjects.length - 3}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-white/60">No subjects assigned</p>
      )}

      {/* Bottom row: meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200/80">
        <span>{hireDateLabel}</span>
        {teacher.subjects.length > 0 && (
          <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-100">
            {teacher.subjects.length} subject{teacher.subjects.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
