// src/components/admin/subjects/SubjectCard.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
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
  School,
  Users,
  Pencil,
  ExternalLink,
  BookOpen,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick();
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-linear-to-br transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        subject.isActive
          ? "border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent shadow-lg shadow-black/30 backdrop-blur-md hover:border-rose-500/40"
          : "border-slate-500/30 bg-gradient-to-br from-slate-600/20 via-slate-700/15 to-transparent shadow-lg shadow-black/30 backdrop-blur-md"
      )}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1",
          subject.isActive ? "bg-rose-500" : "bg-slate-500"
        )}
      />

      {/* Top glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent",
          subject.isActive && "via-rose-500/30"
        )}
        aria-hidden="true"
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-linear-to-br from-rose-500/20 to-pink-500/20">
                <BookOpen className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-white">
                  {subject.name}
                </h3>
                {subject.code && (
                  <p className="text-xs text-white/50">Code: {subject.code}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border border-white/10 bg-slate-900/95 text-xs text-slate-50"
            >
              <DropdownMenuItem
                onClick={handleAction(onView)}
                className="cursor-pointer"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAction(onEdit)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit Subject
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleAction(onAssignToClasses)}
                className="cursor-pointer"
              >
                <School className="mr-2 h-3.5 w-3.5" />
                Assign to Classes
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAction(onAssignTeachers)}
                className="cursor-pointer"
              >
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                Assign Teachers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-2">
            <School className="mb-1 h-4 w-4 text-rose-300" />
            <p className="text-xs font-semibold text-white">
              {subject.classCount}
            </p>
            <p className="text-[10px] text-white/50">Classes</p>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-2">
            <Users className="mb-1 h-4 w-4 text-rose-300" />
            <p className="text-xs font-semibold text-white">
              {subject.teacherCount}
            </p>
            <p className="text-[10px] text-white/50">Teachers</p>
          </div>
        </div>

        {/* Status badge */}
        {!subject.isActive && (
          <div className="mt-3">
            <Badge
              variant="outline"
              className="rounded-full border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-300"
            >
              Inactive
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
