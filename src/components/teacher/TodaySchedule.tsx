"use client";

import * as React from "react";
import { Clock, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const timeLabel = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "Time TBA";
  if (start && end) return `${start} - ${end}`;
  return start || end || "Time TBA";
};

type ScheduleItem = {
  classGroupId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  startTime: string | null;
  endTime: string | null;
};

type TodayScheduleProps = {
  date?: string;
  schedule?: ScheduleItem[];
  loading?: boolean;
};

export function TodaySchedule({ date, schedule = [], loading }: TodayScheduleProps) {
  const displayDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "Today";

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-500/15 via-sky-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-sky-500/20 text-sky-200">
            <CalendarDays className="h-4 w-4" />
          </span>
          Today's Schedule
        </CardTitle>
        <span className="text-xs text-white/50">{displayDate}</span>
      </CardHeader>
      <CardContent className="relative z-10">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            <Clock className="mx-auto mb-3 h-8 w-8 text-white/30" />
            <p>No scheduled classes today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((item) => (
              <div
                key={`${item.classGroupId}-${item.subjectId}-${item.startTime || "tba"}`}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">{item.subjectName}</span>
                  <span className="inline-flex items-center gap-2 text-xs text-white/50">
                    <Clock className="h-3.5 w-3.5" />
                    {timeLabel(item.startTime, item.endTime)}
                  </span>
                </div>
                <div className="text-xs text-white/50">{item.className}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
