"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  AlertTriangle,
  ThumbsUp,
  CalendarCheck,
  Clock,
  Shield,
  Award,
  AlertCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentBehaviourTab({ student }: Props) {
  const { attendanceSummary, attendanceEvents, behaviourSummary, incidents } =
    student;

  const hasAttendance =
    attendanceSummary != null || attendanceEvents.length > 0;
  const hasIncidents = incidents.length > 0;

  return (
    <div className="space-y-6">
      {/* Premium Attendance Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-emerald-500/15 via-emerald-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Presence Rate
                </div>
                <div className="mt-1 text-2xl font-bold text-(--ws-fg)">
                  {attendanceSummary?.presentPercent != null
                    ? `${attendanceSummary.presentPercent.toFixed(1)}%`
                    : "--"}
                </div>
                <p className="text-[10px] text-(--ws-fg-50)">
                  Based on recorded sessions
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-600/20 shadow-inner shadow-white/5">
                <CalendarCheck className="h-5 w-5 text-(--ws-emerald)" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-red-500/15 via-red-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Days Absent
                </div>
                <div className="mt-1 text-2xl font-bold text-(--ws-fg)">
                  {attendanceSummary?.absentDays ?? "--"}
                </div>
                <p className="text-[10px] text-(--ws-fg-50)">
                  Across the selected term
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-linear-to-br from-red-500/20 to-red-600/20 shadow-inner shadow-white/5">
                <AlertCircle className="h-5 w-5 text-red-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-amber-500/15 via-amber-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                  Late Arrivals
                </div>
                <div className="mt-1 text-2xl font-bold text-(--ws-fg)">
                  {attendanceSummary?.lateDays ?? "--"}
                </div>
                <p className="text-[10px] text-(--ws-fg-50)">
                  For morning sessions
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-linear-to-br from-amber-500/20 to-amber-600/20 shadow-inner shadow-white/5">
                <Clock className="h-5 w-5 text-(--ws-amber)" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Details */}
      <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
              <CalendarDays className="h-4 w-4 text-(--ws-cyan)" />
            </div>
            <CardTitle className="text-base font-semibold text-(--ws-fg)">
              Attendance Summary
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {!hasAttendance ? (
            <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-(--ws-line) bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                  <CalendarDays className="h-7 w-7 text-(--ws-cyan)" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-(--ws-fg)">
                    No attendance data yet
                  </p>
                  <p className="text-sm text-(--ws-fg-50)">
                    Once daily attendance is captured, you&apos;ll see present,
                    absent and late patterns here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) overflow-hidden">
              <div className="flex items-center justify-between border-b border-(--ws-line) bg-(--ws-fill) px-4 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-(--ws-fg-60)" />
                  <span className="text-xs font-semibold text-(--ws-fg-70)">
                    Recent Attendance Events
                  </span>
                </div>
              </div>
              {attendanceEvents.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CalendarDays className="mx-auto mb-2 h-6 w-6 text-(--ws-fg-40)" />
                  <p className="text-xs text-(--ws-fg-50)">
                    No detailed attendance events on file yet.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto p-3">
                  {attendanceEvents.map((event) => (
                    <div
                      key={event.id}
                      className="group flex items-center justify-between rounded-lg border border-(--ws-line) bg-(--ws-fill) px-4 py-2.5 transition-colors hover:bg-(--ws-fill-strong)"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-(--ws-fg-50)" />
                        <span className="text-sm text-(--ws-fg)">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          event.status === "present" &&
                            "border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)",
                          event.status === "absent" &&
                            "border-red-500/30 bg-red-500/10 text-red-200",
                          event.status === "late" &&
                            "border-amber-500/30 bg-amber-500/10 text-(--ws-amber)",
                          event.status === "excused" &&
                            "border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan)",
                          !["present", "absent", "late", "excused"].includes(
                            event.status
                          ) && "border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg-70)"
                        )}
                      >
                        {event.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Behaviour & Incidents */}
      <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-rose-500/15 via-rose-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine-strong) to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-linear-to-br from-rose-500/20 to-rose-600/20 shadow-inner shadow-white/5">
              <Shield className="h-5 w-5 text-(--ws-rose)" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-(--ws-fg)">
                Behaviour & Incidents
              </CardTitle>
              <p className="text-xs text-(--ws-fg-50)">
                {incidents.length} incident{incidents.length !== 1 ? "s" : ""}{" "}
                recorded
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-(--ws-rose) hover:bg-rose-500/20"
            >
              <AlertTriangle className="h-4 w-4" />
              Log Incident
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald) hover:bg-emerald-500/20"
            >
              <ThumbsUp className="h-4 w-4" />
              Add Merit
            </Button>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-6">
          {/* Behaviour Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                    Incidents
                  </div>
                  <div className="mt-1 text-xl font-bold text-(--ws-fg)">
                    {behaviourSummary?.incidentsCount ?? incidents.length ?? 0}
                  </div>
                  <p className="text-[10px] text-(--ws-fg-50)">
                    {behaviourSummary?.lastIncidentDate
                      ? `Last on ${new Date(
                          behaviourSummary.lastIncidentDate
                        ).toLocaleDateString()}`
                      : "No incident date recorded"}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
                  <AlertTriangle className="h-4 w-4 text-(--ws-rose)" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                    Positive Notes
                  </div>
                  <div className="mt-1 text-xl font-bold text-(--ws-fg)">
                    {behaviourSummary?.positiveNotesCount ?? 0}
                  </div>
                  <p className="text-[10px] text-(--ws-fg-50)">
                    Commendations and merits
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <Award className="h-4 w-4 text-(--ws-emerald)" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                    Overall Behaviour
                  </div>
                  <div className="mt-1 text-xl font-bold text-(--ws-fg)">
                    {behaviourSummary?.incidentsCount &&
                    behaviourSummary.incidentsCount > 0
                      ? "Monitor"
                      : "Good"}
                  </div>
                  <p className="text-[10px] text-(--ws-fg-50)">
                    Internal indicator only
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                  <Shield className="h-4 w-4 text-(--ws-cyan)" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) overflow-hidden">
            <div className="flex items-center justify-between border-b border-(--ws-line) bg-(--ws-fill) px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-(--ws-fg-60)" />
                <span className="text-xs font-semibold text-(--ws-fg-70)">
                  Recent Incidents
                </span>
              </div>
            </div>
            {!hasIncidents ? (
              <div className="px-4 py-8 text-center">
                <Shield className="mx-auto mb-2 h-6 w-6 text-(--ws-fg-40)" />
                <p className="text-xs text-(--ws-fg-50)">
                  No incidents have been recorded for this student.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-(--ws-rose) hover:bg-rose-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Log First Incident
                </Button>
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-auto p-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="group relative overflow-hidden rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all duration-200 hover:border-rose-500/30 hover:bg-(--ws-fill-strong)"
                  >
                    {/* Accent bar */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                        incident.severity === "high"
                          ? "from-red-500 to-red-600"
                          : incident.severity === "medium"
                          ? "from-amber-500 to-amber-600"
                          : "from-cyan-500 to-cyan-600"
                      )}
                      aria-hidden="true"
                    />

                    <div className="pl-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-(--ws-fg)">
                              {incident.type}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-medium",
                                incident.severity === "high" &&
                                  "border-red-500/30 bg-red-500/10 text-red-200",
                                incident.severity === "medium" &&
                                  "border-amber-500/30 bg-amber-500/10 text-(--ws-amber)",
                                incident.severity === "low" &&
                                  "border-cyan-500/30 bg-cyan-500/10 text-(--ws-cyan)"
                              )}
                            >
                              {incident.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-(--ws-fg-60)">
                            {incident.summary}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[9px] text-(--ws-fg-40)">
                            <CalendarDays className="h-3 w-3" />
                            <span>
                              {new Date(incident.date).toLocaleDateString()}
                            </span>
                            {incident.recordedBy && (
                              <>
                                <span>•</span>
                                <span>Recorded by {incident.recordedBy}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
