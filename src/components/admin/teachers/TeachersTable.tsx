// src/components/admin/teachers/TeachersTable.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TeacherListItem } from "@/types/admin/teacher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function statusClass(status: TeacherListItem["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-slate-400/30 bg-slate-500/10 text-slate-200";
    case "on_leave":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "terminated":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-muted-foreground";
  }
}

export function TeachersTable({
  teachers,
  selectedIds,
  onToggleSelect,
}: {
  teachers: TeacherListItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-separate border-spacing-0">
        <thead>
          <tr className="text-left">
            <th className="sticky left-0 z-10 bg-background/60 backdrop-blur px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Select
            </th>
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Teacher
            </th>
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subjects
            </th>
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Homeroom
            </th>
            <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Created
            </th>
          </tr>
        </thead>

        <tbody>
          {teachers.map((t) => (
            <tr
              key={t.id}
              className="border-t border-white/5 hover:bg-white/[0.03]"
            >
              <td className="sticky left-0 z-10 bg-background/60 backdrop-blur px-3 py-3">
                <button
                  type="button"
                  onClick={() => onToggleSelect(t.id)}
                  className={cn(
                    "h-4 w-4 rounded border transition",
                    selectedIds.includes(t.id)
                      ? "border-primary bg-primary/80"
                      : "border-white/20 bg-white/5 hover:bg-white/10"
                  )}
                  aria-label="Select teacher"
                />
              </td>

              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-white/10">
                    <AvatarImage
                      src={t.photoUrl ?? undefined}
                      alt={t.fullName}
                    />
                    <AvatarFallback>
                      {t.firstName.slice(0, 1)}
                      {t.lastName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <Link
                      href={`/admin/teachers/${t.id}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {t.fullName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.email ?? "—"}
                    </p>
                  </div>
                </div>
              </td>

              <td className="px-3 py-3">
                <Badge
                  variant="outline"
                  className={cn("border", statusClass(t.status))}
                >
                  {t.status.replace("_", " ")}
                </Badge>
              </td>

              <td className="px-3 py-3">
                {t.subjects.length ? (
                  <div className="flex flex-wrap gap-2">
                    {t.subjects.slice(0, 3).map((s) => (
                      <Badge
                        key={s.id}
                        variant="outline"
                        className="border-white/10 bg-white/5"
                      >
                        {s.name}
                      </Badge>
                    ))}
                    {t.subjects.length > 3 ? (
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/5"
                      >
                        +{t.subjects.length - 3}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/80">—</span>
                )}
              </td>

              <td className="px-3 py-3">
                {t.homeroom ? (
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5"
                  >
                    {t.homeroom.name}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground/80">—</span>
                )}
              </td>

              <td className="px-3 py-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
