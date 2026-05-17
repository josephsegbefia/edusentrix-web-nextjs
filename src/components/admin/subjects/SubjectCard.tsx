"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { resolveSubjectVisual } from "@/components/admin/subjects/subject-visuals";
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
  School,
  Users,
  Pencil,
  ExternalLink,
  UserPlus,
  BadgeCheck,
  Layers3,
  Trash2,
} from "lucide-react";

type SubjectCardProps = {
  subject: SubjectDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignToClasses?: (id: string) => void;
  onAssignTeachers?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function SubjectCard({
  subject,
  onView,
  onEdit,
  onAssignToClasses,
  onAssignTeachers,
  onDelete,
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
  const visual = resolveSubjectVisual(subject);
  const Icon = visual.icon;
  const gradeCoverage = subject.gradeNames?.length
    ? subject.gradeNames.join(", ")
    : subject.gradeBand
    ? subject.gradeBand.replace(/_/g, " ")
    : null;

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
        visual.card,
        "shadow-[0_20px_55px_-28px_rgba(0,0,0,0.82)] transition-all duration-300",
        "hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-30px_rgba(0,0,0,0.9)] cursor-pointer"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300",
          visual.glow,
          "opacity-0 group-hover:opacity-100"
        )}
        aria-hidden="true"
      />

      <div className={cn("pointer-events-none absolute inset-y-0 left-0 w-1", visual.accent)} />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-lg shadow-black/30 sm:h-12 sm:w-12",
              visual.iconShell
            )}
          >
            <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", visual.iconColor)} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {subject.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                      visual.codeBadge
                    )}
                  >
                    {subject.code ?? "No code"}
                  </span>
                  {subject.curriculumCode && (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/60">
                      {subject.curriculumCode.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>

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
                  <PremiumDropdownMenuSeparator />
                  <PremiumDropdownMenuItem
                    onClick={handleAction(onDelete)}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    className="text-rose-200 focus:text-rose-100"
                  >
                    Delete subject
                  </PremiumDropdownMenuItem>
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {gradeCoverage && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium capitalize text-cyan-100">
                  <Layers3 className="size-3 shrink-0" />
                  <span className="truncate">{gradeCoverage}</span>
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  subject.isActive
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/55"
                )}
              >
                {subject.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <School className={cn("h-3.5 w-3.5", visual.statIcon)} />
            <span className="text-xs font-medium text-white/80">
              {classCount} class{classCount !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Users className={cn("h-3.5 w-3.5", visual.statIcon)} />
            <span className="text-xs font-medium text-white/80">
              {teacherCount} teacher{teacherCount !== 1 ? "s" : ""}
            </span>
          </div>
          {subject.lessonNoteTemplateVariant && (
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
              <BadgeCheck className={cn("h-3.5 w-3.5 shrink-0", visual.statIcon)} />
              <span className="truncate text-xs font-medium capitalize text-white/70">
                {subject.lessonNoteTemplateVariant.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
