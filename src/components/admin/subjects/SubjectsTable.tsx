// src/components/admin/subjects/SubjectsTable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  School,
  Users,
  ExternalLink,
  Pencil,
  BookOpen,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type SubjectsTableProps = {
  subjects: SubjectDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignToClasses?: (id: string) => void;
  onAssignTeachers?: (id: string) => void;
};

export function SubjectsTable({
  subjects,
  onView,
  onEdit,
  onAssignToClasses,
  onAssignTeachers,
}: SubjectsTableProps) {
  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <BookOpen className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">
          No subjects found
        </p>
        <p className="mt-1 text-xs text-white/50">
          Create your first subject to get started
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
              Subject
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
              Classes
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
          {subjects.map((subject) => (
            <tr
              key={subject.id}
              className="group transition-colors hover:bg-white/5"
            >
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-linear-to-br from-rose-500/20 to-pink-500/20">
                    <BookOpen className="h-5 w-5 text-rose-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{subject.name}</p>
                    {subject.code && (
                      <p className="text-xs text-white/50">Code: {subject.code}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <School className="h-4 w-4 text-rose-300" />
                  <span className="font-medium text-white">
                    {subject.classCount}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-4 w-4 text-rose-300" />
                  <span className="font-medium text-white">
                    {subject.teacherCount}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    subject.isActive
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                  )}
                >
                  {subject.isActive ? "Active" : "Inactive"}
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
                      onClick={() => onView?.(subject.id)}
                      className="cursor-pointer"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onEdit?.(subject.id)}
                      className="cursor-pointer"
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit Subject
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => onAssignToClasses?.(subject.id)}
                      className="cursor-pointer"
                    >
                      <School className="mr-2 h-3.5 w-3.5" />
                      Assign to Classes
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onAssignTeachers?.(subject.id)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                      Assign Teachers
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
