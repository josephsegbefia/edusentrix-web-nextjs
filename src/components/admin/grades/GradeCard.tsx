"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { GradeDTO } from "@/hooks/admin/useGrades";
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
  ExternalLink,
  Pencil,
  GraduationCap,
  Users,
  Layers,
} from "lucide-react";

type GradeCardProps = {
  grade: GradeDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
};

export function GradeCard({
  grade,
  onView,
  onEdit,
}: GradeCardProps) {
  const handleCardClick = () => {
    onView?.(grade.id);
  };

  const handleAction =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (fn) fn(grade.id);
    };

  const classCount = grade.classCount ?? 0;
  const studentCount = grade.studentCount ?? 0;

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
        "border-blue-500/30 from-blue-500/10 via-indigo-500/5 to-transparent",
        "shadow-xl shadow-black/30 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 cursor-pointer"
      )}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300",
          "bg-blue-500/20 opacity-0 group-hover:opacity-100"
        )}
        aria-hidden="true"
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      {/* Accent bar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-blue-500" />

      {/* Card content */}
      <div className="relative z-10 flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        {/* Header: Icon + Name + Menu */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-linear-to-br from-blue-500/20 to-indigo-500/20 shadow-lg shadow-blue-500/10 sm:h-12 sm:w-12">
            <GraduationCap className="h-5 w-5 text-blue-300 sm:h-6 sm:w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {grade.name}
                </h3>
                <p className="truncate text-xs text-white/50">
                  {grade.code ? `${grade.code} • ${grade.stage}` : grade.stage}
                </p>
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
                    View grade
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onEdit)}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit details
                  </PremiumDropdownMenuItem>
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
            </div>

            {/* Status badge */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  grade.isActive
                    ? "border-blue-500/30 bg-blue-500/20 text-blue-300"
                    : "border-slate-500/30 bg-slate-500/20 text-slate-300"
                )}
              >
                {grade.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Layers className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-xs font-medium text-white/80">
              {classCount} class{classCount !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-xs font-medium text-white/80">
              {studentCount} student{studentCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
