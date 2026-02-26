// src/components/admin/subjects/SubjectCard.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, School, Users, Pencil, ExternalLink, BookOpen, UserPlus } from "lucide-react";

type SubjectCardProps = {
  subject: SubjectDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignToClasses?: (id: string) => void;
  onAssignTeachers?: (id: string) => void;
};

export function SubjectCard({
  subject,
  onView,
  onEdit,
  onAssignToClasses,
  onAssignTeachers,
}: SubjectCardProps) {
  const handleCardClick = () => {
    onView?.(subject.id);
  };

  const handleAction =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (fn) fn(subject.id);
    };

  const classCount = subject.classCount ?? 0;
  const teacherCount = subject.teacherCount ?? 0;

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
        "border-slate-700/60 from-slate-800/55 via-slate-900/45 to-black/30",
        "shadow-xl shadow-black/30 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 cursor-pointer"
      )}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300",
          "bg-slate-600/20 opacity-0 group-hover:opacity-100"
        )}
        aria-hidden="true"
      />

      {/* Accent bar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-slate-500/80" />

      {/* Top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-600/40 bg-linear-to-br from-slate-700/30 to-slate-800/30 shadow-lg shadow-black/30 sm:h-12 sm:w-12">
            <BookOpen className="h-5 w-5 text-slate-200 sm:h-6 sm:w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {subject.name}
                </h3>
                <p className="truncate text-xs text-white/50">
                  {subject.code ?? "No code"}
                </p>
              </div>

              {/* Actions dropdown */}
              <PremiumDropdownMenu>
                <PremiumDropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
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
                    onClick={handleAction(onView)}
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                  >
                    View subject
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onEdit)}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit details
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuSeparator />
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onAssignToClasses)}
                    icon={<School className="h-3.5 w-3.5" />}
                  >
                    Assign to classes
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onAssignTeachers)}
                    icon={<UserPlus className="h-3.5 w-3.5" />}
                  >
                    Assign teachers
                  </PremiumDropdownMenuItem>
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
            </div>

            {/* Status badge */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  subject.isActive
                    ? "border-slate-500/40 bg-slate-600/25 text-slate-200"
                    : "border-slate-500/30 bg-slate-500/20 text-slate-300"
                )}
              >
                {subject.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <School className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-xs font-medium text-white/80">
              {classCount} class{classCount !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-xs font-medium text-white/80">
              {teacherCount} teacher{teacherCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
