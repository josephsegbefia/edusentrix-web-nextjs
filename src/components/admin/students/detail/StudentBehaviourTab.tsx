"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, AlertTriangle, ThumbsUp } from "lucide-react";
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
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)]">
      {/* Left: attendance */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 text-xs">
            {!hasAttendance ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[11px] text-muted-foreground/90">
                No attendance data has been recorded for this student yet. Once
                daily attendance is captured, you&apos;ll see present, absent
                and late patterns here.
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Presence Rate
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {attendanceSummary?.presentPercent != null
                        ? `${attendanceSummary.presentPercent.toFixed(1)}%`
                        : "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      Based on recorded sessions
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Days Absent
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {attendanceSummary?.absentDays ?? "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      Across the selected term
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Late Arrivals
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {attendanceSummary?.lateDays ?? "--"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      For morning sessions
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Recent Attendance Events
                    </div>
                  </div>
                  {attendanceEvents.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] text-muted-foreground/80">
                      No detailed attendance events on file yet.
                    </div>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-auto px-3 py-2 text-[11px]">
                      {attendanceEvents.map((event) => (
                        <li
                          key={event.id}
                          className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5"
                        >
                          <span>
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-white/20 bg-black/20 text-[10px]"
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
      </div>

      {/* Right: incidents & behaviour */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 flex items-center justify-between gap-3 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Behaviour & Incidents
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-black/40 text-[11px]"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Log Incident
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-black/40 text-[11px]"
              >
                <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                Add Merit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 text-xs">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  Incidents
                </div>
                <div className="mt-1 text-base font-semibold">
                  {behaviourSummary?.incidentsCount ?? incidents.length ?? 0}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                  {behaviourSummary?.lastIncidentDate
                    ? `Last on ${new Date(
                        behaviourSummary.lastIncidentDate
                      ).toLocaleDateString()}`
                    : "No incident date recorded"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  Positive Notes
                </div>
                <div className="mt-1 text-base font-semibold">
                  {behaviourSummary?.positiveNotesCount ?? 0}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                  Commendations and merits
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  Overall Behaviour
                </div>
                <div className="mt-1 text-base font-semibold">
                  {behaviourSummary?.incidentsCount &&
                  behaviourSummary.incidentsCount > 0
                    ? "Monitor"
                    : "Good"}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                  Internal indicator only
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Recent Incidents
                </div>
              </div>
              {!hasIncidents ? (
                <div className="px-3 py-3 text-[11px] text-muted-foreground/80">
                  No incidents have been recorded for this student.
                </div>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-auto px-3 py-2 text-[11px]">
                  {incidents.map((incident) => (
                    <li
                      key={incident.id}
                      className="rounded-lg bg-white/5 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{incident.type}</span>
                        <span className="text-[10px] text-muted-foreground/80">
                          {new Date(incident.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground/80">
                        <span className="line-clamp-2">{incident.summary}</span>
                        <Badge
                          variant="outline"
                          className="ml-2 border-white/20 bg-black/20 text-[9px]"
                        >
                          {incident.severity.toUpperCase()}
                        </Badge>
                      </div>
                      {incident.recordedBy && (
                        <div className="mt-0.5 text-[9px] text-muted-foreground/70">
                          Recorded by {incident.recordedBy}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
