"use client";

import * as React from "react";
import { DAY_NAMES, formatTimeLabel } from "@/components/admin/timetable/types";
import type { PublishedClassSlotDTO } from "@/hooks/admin/useClassPublishedTimetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return 0;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

type PublishedTimetableCalendarProps = {
  classLabel: string;
  workingDays: number[];
  timeAxis: { startHour: number; endHour: number; hours: number[] };
  hourLabels?: string[];
  slots: PublishedClassSlotDTO[];
};

/**
 * Read-only week view: days on the vertical axis, time on the horizontal axis.
 */
export function PublishedTimetableCalendar({
  classLabel,
  workingDays,
  timeAxis,
  hourLabels,
  slots,
}: PublishedTimetableCalendarProps) {
  const { startHour, endHour } = timeAxis;
  const hours = timeAxis.hours.length
    ? timeAxis.hours
    : Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i);

  const axisStartMins = startHour * 60;
  const axisEndMins = endHour * 60;
  const totalMins = Math.max(1, axisEndMins - axisStartMins);

  const labels =
    hourLabels?.length && hourLabels.length === hours.length
      ? hourLabels
      : hours.map((h) => `${String(h).padStart(2, "0")}:00`);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Published timetable · {classLabel}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Weekdays on the left, times across the top. This is the current published schedule for
          the class.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full overflow-x-auto rounded-lg border border-border/80">
          <div className="min-w-[700px]">
            <div className="flex border-b border-border/60 bg-muted/30">
              <div className="flex w-[100px] shrink-0 items-center border-r border-border/60 p-2 text-xs font-medium text-muted-foreground" />
              <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0,1fr))` }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="border-l border-dashed border-border/40 py-2 text-center text-xs font-medium text-foreground first:border-l-0"
                  >
                    {labels[i]}
                  </div>
                ))}
              </div>
            </div>

            {workingDays.map((dow) => {
              const daySlots = slots.filter((s) => s.dayOfWeek === dow);
              return (
                <div key={dow} className="flex border-b border-border/50 last:border-b-0">
                  <div className="flex w-[100px] shrink-0 items-center border-r border-border/60 bg-muted/25 px-2 py-2" style={{ minHeight: 64 }}>
                    <span className="text-xs font-semibold leading-tight text-foreground">
                      {DAY_NAMES[dow] ?? `Day ${dow}`}
                    </span>
                  </div>
                  <div className="relative min-h-[64px] min-w-0 flex-1 bg-background/30">
                    <div className="pointer-events-none absolute inset-0 z-0 grid" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0,1fr))` }}>
                      {hours.map((h) => (
                        <div key={h} className="border-l border-dashed border-border/30 first:border-l-0" />
                      ))}
                    </div>
                    <div className="relative z-1 min-h-[64px] px-0.5 py-1">
                      {daySlots.length === 0 ? (
                        <p className="px-1 text-center text-xs text-muted-foreground">No lessons</p>
                      ) : null}
                      {daySlots.map((slot) => {
                        const start = timeToMinutes(slot.startTime);
                        const end = timeToMinutes(slot.endTime);
                        const left = ((start - axisStartMins) / totalMins) * 100;
                        const w = ((end - start) / totalMins) * 100;
                        if (w <= 0) return null;
                        return (
                          <div
                            key={slot.id}
                            className="absolute box-border min-h-[48px] rounded border border-border/60 bg-primary/10 px-1.5 py-1 text-left shadow-sm"
                            style={{
                              left: `${Math.max(0, left)}%`,
                              width: `${Math.min(100 - Math.max(0, left), Math.max(2, w))}%`,
                              top: 4,
                            }}
                          >
                            <p className="truncate text-xs font-semibold text-foreground">
                              {slot.subjectName}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {formatTimeLabel(slot.startTime)}–{formatTimeLabel(slot.endTime)}
                            </p>
                            {slot.teacherName && slot.teacherName !== "Unassigned" ? (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {slot.teacherName}
                              </p>
                            ) : null}
                            {slot.classroomLabel ? (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {slot.classroomLabel}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
