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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  UserCog,
  Home,
  BookOpen,
  ExternalLink,
  Calendar,
  Briefcase,
  Power,
  Clock,
} from "lucide-react";

type TeacherCardProps = {
  teacher: TeacherListItemDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onActivate?: (id: string) => void;
  onUpdateLeave?: (id: string) => void;
};

type StatusTone = "emerald" | "rose" | "amber" | "slate";

function getStatusTone(t: TeacherListItemDTO): StatusTone {
  switch (t.status) {
    case "active":
      return "emerald";
    case "on_leave":
      return "amber";
    case "terminated":
      return "rose";
    case "inactive":
    default:
      return "slate";
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
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    glow: "bg-emerald-500/20",
    accent: "bg-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
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
};

export function TeacherCard({
  teacher,
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
  onActivate,
  onUpdateLeave,
}: TeacherCardProps) {
  const tone = getStatusTone(teacher);
  const config = toneConfig[tone];

  const hireDateLabel = React.useMemo(() => {
    if (!teacher.hireDate) return null;
    const d = new Date(teacher.hireDate);
    return d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
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

  const leaveInfo = React.useMemo(() => {
    if (teacher.status !== "on_leave" || !teacher.leaveStartDate || !teacher.leaveEndDate) return null;
    const start = new Date(teacher.leaveStartDate);
    const end = new Date(teacher.leaveEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return { daysLeft, startLabel, endLabel };
  }, [teacher.status, teacher.leaveStartDate, teacher.leaveEndDate]);

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
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-xl",
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
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
      <div className="relative z-10 flex flex-col gap-4 p-5">
        {/* Header: Avatar + Name + Menu */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <TeacherAvatarStatus
              fullName={teacher.fullName}
              firstName={teacher.firstName}
              lastName={teacher.lastName}
              photoUrl={teacher.photoUrl}
              status={teacher.status}
              size="md"
            />
            {teacher.isNew && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-indigo-500 text-[8px] font-bold text-white">
                N
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-sm font-semibold text-white">
                  {teacher.fullName}
                </h3>
                <p className="truncate text-xs text-white/50">
                  {teacher.email ?? "No email"}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[180px] rounded-xl border border-white/10 bg-slate-900/95 p-1 text-xs text-slate-50 shadow-xl backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    onClick={handleAction(onView)}
                    className="gap-2 rounded-lg"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleAction(onEdit)}
                    className="gap-2 rounded-lg"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleAction(onManageAccess)}
                    className="gap-2 rounded-lg"
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    Manage access
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleAction(onSendMessage)}
                    className="gap-2 rounded-lg"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Send message
                  </DropdownMenuItem>
                  {teacher.status === "on_leave" && (
                    <>
                      <DropdownMenuSeparator className="bg-white/10" />
                      {onUpdateLeave && (
                        <DropdownMenuItem
                          onClick={handleAction(onUpdateLeave)}
                          className="gap-2 rounded-lg text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Update leave dates
                        </DropdownMenuItem>
                      )}
                      {onActivate && (
                        <DropdownMenuItem
                          onClick={handleAction(onActivate)}
                          className="gap-2 rounded-lg text-emerald-300 focus:text-emerald-200 focus:bg-emerald-500/10"
                        >
                          <Power className="h-3.5 w-3.5" />
                          End leave
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
              {teacher.employeeId && (
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                  {teacher.employeeId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap items-center gap-2">
          {teacher.homeroom && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-[10px] font-medium text-purple-200">
              <Home className="h-3 w-3" />
              {teacher.homeroom.name}
            </span>
          )}
          {teacher.department && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-medium text-indigo-200">
              <Briefcase className="h-3 w-3" />
              {teacher.department}
            </span>
          )}
        </div>

        {/* Leave info banner */}
        {leaveInfo && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
              <span className="text-sm font-bold text-amber-200">{leaveInfo.daysLeft}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-amber-200">
                {leaveInfo.daysLeft === 0
                  ? "Leave ends today"
                  : `${leaveInfo.daysLeft} day${leaveInfo.daysLeft !== 1 ? "s" : ""} left`}
              </p>
              <p className="text-[10px] text-amber-200/60 truncate">
                {leaveInfo.startLabel && `${leaveInfo.startLabel} → `}{leaveInfo.endLabel}
              </p>
            </div>
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-200/40" />
          </div>
        )}

        {/* Subjects */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
            <BookOpen className="h-3 w-3" />
            <span>Subjects</span>
          </div>
          {teacher.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {teacher.subjects.slice(0, 4).map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70"
                >
                  {s.name}
                </span>
              ))}
              {teacher.subjects.length > 4 && (
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-medium text-white/80">
                  +{teacher.subjects.length - 4} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] italic text-white/40">
              No subjects assigned
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <Calendar className="h-3 w-3" />
          <span>{hireDateLabel ? `Hired ${hireDateLabel}` : "Hire date unknown"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/70">
            {teacher.subjects.length}
          </span>
          <span className="text-[10px] text-white/40">subjects</span>
        </div>
      </div>
    </div>
  );
}
