// src/components/admin/classes/ClassCard.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";
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
  Users,
  BookOpen,
  UserCheck,
  UserX,
  Pencil,
  ExternalLink,
  School,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type ClassCardProps = {
  classGroup: ClassGroupDTO;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignHomeroom?: (id: string) => void;
  onAssignSubjects?: (id: string) => void;
};

export function ClassCard({
  classGroup,
  onView,
  onEdit,
  onAssignHomeroom,
  onAssignSubjects,
}: ClassCardProps) {
  const handleCardClick = () => {
    onView?.(classGroup.id);
  };

  const handleAction =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (fn) fn(classGroup.id);
    };

  const homeroomInitials = React.useMemo(() => {
    if (!classGroup.homeroomTeacher) return "HT";
    const first = classGroup.homeroomTeacher.firstName?.charAt(0) || "";
    const last = classGroup.homeroomTeacher.lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "HT";
  }, [classGroup.homeroomTeacher]);

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
        classGroup.isActive
          ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-lg shadow-black/30 backdrop-blur-md hover:border-emerald-500/40"
          : "border-slate-500/30 bg-gradient-to-br from-slate-600/20 via-slate-700/15 to-transparent shadow-lg shadow-black/30 backdrop-blur-md"
      )}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1",
          classGroup.isActive ? "bg-emerald-500" : "bg-slate-500"
        )}
      />

      {/* Top glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent",
          classGroup.isActive && "via-emerald-500/30"
        )}
        aria-hidden="true"
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-green-500/20">
                <School className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-white">
                  {classGroup.fullLabel}
                </h3>
                <p className="text-xs text-white/50">{classGroup.grade.name}</p>
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
                Edit Class
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleAction(onAssignHomeroom)}
                className="cursor-pointer"
              >
                {classGroup.homeroomTeacher ? (
                  <>
                    <UserX className="mr-2 h-3.5 w-3.5" />
                    Change Homeroom Teacher
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-3.5 w-3.5" />
                    Assign Homeroom Teacher
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAction(onAssignSubjects)}
                className="cursor-pointer"
              >
                <BookOpen className="mr-2 h-3.5 w-3.5" />
                Manage Subjects
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Homeroom Teacher */}
        {classGroup.homeroomTeacher && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
            <Avatar className="h-8 w-8 border border-white/20">
              {classGroup.homeroomTeacher.photoUrl ? (
                <AvatarImage
                  src={classGroup.homeroomTeacher.photoUrl}
                  alt={classGroup.homeroomTeacher.fullName}
                />
              ) : (
                <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                  {homeroomInitials}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">
                {classGroup.homeroomTeacher.fullName}
              </p>
              <p className="text-[10px] text-white/50">Homeroom Teacher</p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"
            >
              <UserCheck className="mr-1 h-2.5 w-2.5" />
              Assigned
            </Badge>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-2">
            <Users className="mb-1 h-4 w-4 text-emerald-300" />
            <p className="text-xs font-semibold text-white">
              {classGroup.studentCount}
            </p>
            <p className="text-[10px] text-white/50">Students</p>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-2">
            <BookOpen className="mb-1 h-4 w-4 text-emerald-300" />
            <p className="text-xs font-semibold text-white">
              {classGroup.subjectCount}
            </p>
            <p className="text-[10px] text-white/50">Subjects</p>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-2">
            <UserCheck className="mb-1 h-4 w-4 text-emerald-300" />
            <p className="text-xs font-semibold text-white">
              {classGroup.teacherCount}
            </p>
            <p className="text-[10px] text-white/50">Teachers</p>
          </div>
        </div>

        {/* Subjects preview */}
        {classGroup.subjects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {classGroup.subjects.slice(0, 3).map((subject) => (
              <Badge
                key={subject.id}
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/80"
              >
                {subject.name}
              </Badge>
            ))}
            {classGroup.subjects.length > 3 && (
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60"
              >
                +{classGroup.subjects.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Status badge */}
        {!classGroup.isActive && (
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
