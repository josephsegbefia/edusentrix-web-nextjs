// src/components/admin/classes/ClassesTable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Users,
  BookOpen,
  UserCheck,
  UserX,
  ExternalLink,
  Pencil,
  School,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ClassesTableProps = {
  classes: ClassGroupDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignHomeroom?: (id: string) => void;
  onAssignSubjects?: (id: string) => void;
};

export function ClassesTable({
  classes,
  onView,
  onEdit,
  onAssignHomeroom,
  onAssignSubjects,
}: ClassesTableProps) {
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <School className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">
          No classes found
        </p>
        <p className="mt-1 text-xs text-white/50">
          Create your first class to get started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/60 shadow-2xl shadow-black/30 backdrop-blur">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
              Class
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
              Homeroom Teacher
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
              Students
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
              Subjects
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
              Teachers
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/60">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {classes.map((classGroup) => {
            const homeroomInitials = classGroup.homeroomTeacher
              ? `${classGroup.homeroomTeacher.firstName?.charAt(0) || ""}${classGroup.homeroomTeacher.lastName?.charAt(0) || ""}`.toUpperCase() || "HT"
              : null;

            return (
              <tr
                key={classGroup.id}
                className="group transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-green-500/20">
                      <School className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{classGroup.fullLabel}</p>
                      <p className="text-xs text-white/50">{classGroup.grade.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {classGroup.homeroomTeacher ? (
                    <div className="flex items-center gap-2">
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
                      <div>
                        <p className="text-sm font-medium text-white">
                          {classGroup.homeroomTeacher.fullName}
                        </p>
                        <p className="text-xs text-white/50">Homeroom</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-white/40">Not assigned</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-4 w-4 text-emerald-300" />
                    <span className="font-medium text-white">
                      {classGroup.studentCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BookOpen className="h-4 w-4 text-emerald-300" />
                    <span className="font-medium text-white">
                      {classGroup.subjectCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <UserCheck className="h-4 w-4 text-emerald-300" />
                    <span className="font-medium text-white">
                      {classGroup.teacherCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px]",
                      classGroup.isActive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                    )}
                  >
                    {classGroup.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
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
                        onClick={() => onView?.(classGroup.id)}
                        className="cursor-pointer"
                      >
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEdit?.(classGroup.id)}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit Class
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={() => onAssignHomeroom?.(classGroup.id)}
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
                        onClick={() => onAssignSubjects?.(classGroup.id)}
                        className="cursor-pointer"
                      >
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        Manage Subjects
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
