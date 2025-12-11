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
    <div className="mt-4 space-y-6">
      {/* Premium Attendance Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                <CalendarCheck className="h-4 w-4 text-emerald-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Presence Rate
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {attendanceSummary?.presentPercent != null
                ? `${attendanceSummary.presentPercent.toFixed(1)}%`
                : "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Based on recorded sessions
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/10 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 border border-red-400/30">
                <AlertCircle className="h-4 w-4 text-red-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Days Absent
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {attendanceSummary?.absentDays ?? "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Across the selected term
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/30">
                <Clock className="h-4 w-4 text-amber-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Late Arrivals
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {attendanceSummary?.lateDays ?? "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              For morning sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Details */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-blue-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
              <CalendarDays className="h-4 w-4 text-blue-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Attendance Summary
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-xs">
          {!hasAttendance ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No attendance data has been recorded for this student yet.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Once daily attendance is captured, you&apos;ll see present,
                absent and late patterns here.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-black/40">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground/80" />
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Recent Attendance Events
                    </span>
                  </div>
                </div>
                {attendanceEvents.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                    <p className="text-[11px] text-muted-foreground/80">
                      No detailed attendance events on file yet.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-auto px-3 py-2 text-[11px]">
                    {attendanceEvents.map((event) => (
                      <li
                        key={event.id}
                        className="group flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span className="text-foreground">
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-white/20 bg-black/20 text-[10px] font-medium"
                        >
                          {event.status.toUpperCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Behaviour & Incidents */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/5 via-red-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 border border-red-400/30">
              <Shield className="h-4 w-4 text-red-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Behaviour & Incidents
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer border border-white/20 bg-black/40 text-[11px] text-white/80 transition-all duration-200 hover:scale-105 hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-100 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Log Incident
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer border border-white/20 bg-black/40 text-[11px] text-white/80 transition-all duration-200 hover:scale-105 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:shadow-md hover:shadow-emerald-500/20 active:scale-95"
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
              Add Merit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4 text-xs">
          {/* Behaviour Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-red-500/10 to-transparent shadow-md">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 border border-red-400/30">
                    <AlertTriangle className="h-4 w-4 text-red-200" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Incidents
                  </span>
                </div>
                <div className="mb-1 text-2xl font-bold text-foreground">
                  {behaviourSummary?.incidentsCount ?? incidents.length ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground/80">
                  {behaviourSummary?.lastIncidentDate
                    ? `Last on ${new Date(
                        behaviourSummary.lastIncidentDate
                      ).toLocaleDateString()}`
                    : "No incident date recorded"}
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent shadow-md">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                    <Award className="h-4 w-4 text-emerald-200" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Positive Notes
                  </span>
                </div>
                <div className="mb-1 text-2xl font-bold text-foreground">
                  {behaviourSummary?.positiveNotesCount ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground/80">
                  Commendations and merits
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-blue-500/10 to-transparent shadow-md">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
                    <Shield className="h-4 w-4 text-blue-200" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Overall Behaviour
                  </span>
                </div>
                <div className="mb-1 text-2xl font-bold text-foreground">
                  {behaviourSummary?.incidentsCount &&
                  behaviourSummary.incidentsCount > 0
                    ? "Monitor"
                    : "Good"}
                </div>
                <p className="text-[10px] text-muted-foreground/80">
                  Internal indicator only
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Incidents */}
          <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-black/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground/80" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Recent Incidents
                </span>
              </div>
            </div>
            {!hasIncidents ? (
              <div className="px-4 py-6 text-center">
                <Shield className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                <p className="text-[11px] text-muted-foreground/80">
                  No incidents have been recorded for this student.
                </p>
              </div>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto px-3 py-2 text-[11px]">
                {incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className="group rounded-lg bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {incident.type}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] border font-medium",
                              incident.severity === "high" &&
                                "border-red-400/60 bg-red-500/10 text-red-100",
                              incident.severity === "medium" &&
                                "border-amber-400/60 bg-amber-500/10 text-amber-100",
                              incident.severity === "low" &&
                                "border-blue-400/60 bg-blue-500/10 text-blue-100"
                            )}
                          >
                            {incident.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground/90 line-clamp-2">
                          {incident.summary}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground/70">
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
