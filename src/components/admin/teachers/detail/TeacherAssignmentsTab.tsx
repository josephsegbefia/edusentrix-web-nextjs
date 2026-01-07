/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/admin/teachers/detail/TeacherAssignmentsTab.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCreateTeacherAssignment,
  useDeactivateTeacherAssignment,
  useTeacherAssignments,
} from "@/hooks/admin/useTeacherAssignments";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function SchedulePill({ s }: { s: any }) {
  if (!s || s.dayOfWeek == null || !s.startTime || !s.endTime) return null;
  const day = DOW[s.dayOfWeek] ?? `D${s.dayOfWeek}`;
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
      {day} • {s.startTime}-{s.endTime}
      {s.location ? (
        <span className="ml-1 text-white/50">({s.location})</span>
      ) : null}
    </span>
  );
}

export function TeacherAssignmentsTab({ teacherId }: { teacherId: string }) {
  const [academicPeriodId, setAcademicPeriodId] = React.useState<string>(""); // optional filter
  const { data, isLoading, isError } = useTeacherAssignments(
    teacherId,
    academicPeriodId || undefined,
    "active"
  );

  const { mutateAsync: deactivate, isPending: isDeactivating } =
    useDeactivateTeacherAssignment(teacherId);

  // We’ll wire create modal next; for now keep CTA consistent
  const { mutateAsync: createAssignment } =
    useCreateTeacherAssignment(teacherId);

  const assignments = data?.data ?? [];

  return (
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Assignments</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            className="gap-2"
            onClick={() =>
              alert(
                "Create assignment modal comes next (we’ll build it premium)"
              )
            }
          >
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Assign subjects to class groups (per academic period).
          </div>

          {/* Academic period filter (optional now; we’ll replace with real dropdown soon) */}
          <input
            value={academicPeriodId}
            onChange={(e) => setAcademicPeriodId(e.target.value)}
            placeholder="Filter by academicPeriodId (optional)"
            className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm md:w-[360px]"
          />
        </div>

        <Separator className="bg-white/10" />

        {isLoading ? (
          <div className="flex items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
            <p className="text-sm text-muted-foreground">
              Loading assignments…
            </p>
          </div>
        ) : isError ? (
          <p className="py-10 text-sm text-red-300/80">
            Failed to load assignments.
          </p>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                <ClipboardList className="h-5 w-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">No assignments yet</p>
                <p className="text-sm text-muted-foreground">
                  Create the first assignment to connect a subject and class
                  group for this teacher.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Button
                className="gap-2"
                onClick={() => alert("Create assignment modal comes next")}
              >
                <Plus className="h-4 w-4" />
                Create Assignment
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {a.subject?.name ?? "—"}{" "}
                      <span className="text-muted-foreground/70">•</span>{" "}
                      {a.classGroup?.name ?? "—"}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-white/10 bg-white/5",
                        a.status === "active"
                          ? "text-emerald-200"
                          : "text-slate-200"
                      )}
                    >
                      {a.status}
                    </Badge>
                    <SchedulePill s={a.schedule} />
                  </div>

                  {a.notes ? (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2">
                      {a.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={isDeactivating}
                    onClick={() => deactivate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Deactivate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
