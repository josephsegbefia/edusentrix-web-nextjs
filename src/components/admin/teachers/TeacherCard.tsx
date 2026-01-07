// src/components/admin/teachers/TeacherCard.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MoreVertical, Home } from "lucide-react";
import type { TeacherListItemDTO } from "@/types/admin/teacher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function statusTone(status: TeacherListItemDTO["status"]) {
  switch (status) {
    case "active":
      return {
        badge: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
      };
    case "inactive":
      return { badge: "bg-slate-500/10 text-slate-200 border-slate-400/30" };
    case "on_leave":
      return { badge: "bg-amber-500/10 text-amber-200 border-amber-400/30" };
    case "terminated":
      return { badge: "bg-red-500/10 text-red-200 border-red-400/30" };
    default:
      return { badge: "bg-white/5 text-muted-foreground border-white/10" };
  }
}

export function TeacherCard({
  teacher,
  selected,
  onToggleSelect,
}: {
  teacher: TeacherListItemDTO;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const tone = statusTone(teacher.status);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent",
        "px-4 py-4 shadow-lg shadow-black/30 backdrop-blur-md transition-transform duration-150 hover:-translate-y-[2px]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggleSelect(teacher.id)}
            className={cn(
              "mt-1 h-4 w-4 rounded border transition",
              selected
                ? "border-primary bg-primary/80"
                : "border-white/20 bg-white/5 hover:bg-white/10"
            )}
            aria-pressed={selected}
            aria-label="Select teacher"
          />
          <Avatar className="h-10 w-10 border border-white/10">
            <AvatarImage
              src={teacher.photoUrl ?? undefined}
              alt={teacher.fullName}
            />
            <AvatarFallback>
              {teacher.firstName.slice(0, 1)}
              {teacher.lastName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <Link
              href={`/admin/teachers/${teacher.id}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {teacher.fullName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {teacher.email ?? "—"}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border", tone.badge)}>
                {teacher.status.replace("_", " ")}
              </Badge>

              {teacher.homeroom ? (
                <Badge variant="outline" className="border-white/10 bg-white/5">
                  <Home className="mr-1 h-3.5 w-3.5" />
                  {teacher.homeroom.name}
                </Badge>
              ) : null}

              {teacher.isNew ? (
                <Badge
                  variant="outline"
                  className="border-blue-400/30 bg-blue-500/10 text-blue-200"
                >
                  New
                </Badge>
              ) : null}
            </div>

            {teacher.subjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {teacher.subjects.slice(0, 4).map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-white/10 bg-white/5"
                  >
                    {s.name}
                  </Badge>
                ))}
                {teacher.subjects.length > 4 ? (
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5"
                  >
                    +{teacher.subjects.length - 4}
                  </Badge>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground/80">
                No subjects assigned
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:bg-white/10"
              aria-label="Teacher actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/admin/teachers/${teacher.id}`}>View profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleSelect(teacher.id)}>
              {selected ? "Unselect" : "Select"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
