"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, CalendarDays, BookOpen, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const timeLabel = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "Time TBA";
  if (start && end) return `${start} – ${end}`;
  return start || end || "Time TBA";
};

const todayParam = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const periodColors = [
  { border: "border-sky-500/25", dot: "bg-sky-400", text: "text-sky-300", bg: "from-sky-500/8" },
  { border: "border-violet-500/25", dot: "bg-violet-400", text: "text-violet-300", bg: "from-violet-500/8" },
  { border: "border-emerald-500/25", dot: "bg-emerald-400", text: "text-emerald-300", bg: "from-emerald-500/8" },
  { border: "border-amber-500/25", dot: "bg-amber-400", text: "text-amber-300", bg: "from-amber-500/8" },
  { border: "border-rose-500/25", dot: "bg-rose-400", text: "text-rose-300", bg: "from-rose-500/8" },
  { border: "border-indigo-500/25", dot: "bg-indigo-400", text: "text-indigo-300", bg: "from-indigo-500/8" },
];

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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-500/10 via-sky-500/5 to-transparent"
        aria-hidden
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-sky-500/20">
            <CalendarDays className="h-4 w-4 text-sky-200" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Today&apos;s Schedule</h3>
            <p className="text-[11px] text-white/40">{displayDate}</p>
          </div>
        </div>

        {!loading && schedule.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-white/50">
            {schedule.length} class{schedule.length !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 w-full animate-pulse rounded-2xl border border-white/8 bg-white/5"
              />
            ))}
          </div>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Clock className="h-6 w-6 text-white/25" />
            </div>
            <p className="text-sm font-medium text-white/50">
              No classes today
            </p>
            <p className="mt-1 text-xs text-white/30">
              Enjoy your free day or use it to catch up on planning.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {schedule.map((item, idx) => {
              const color = periodColors[idx % periodColors.length];
              return (
                <div
                  key={`${item.classGroupId}-${item.subjectId}-${item.startTime || "tba"}`}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border bg-linear-to-r to-transparent p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20",
                    color.border,
                    color.bg
                  )}
                >
                  {/* Timeline indicator */}
                  <div className="absolute bottom-0 left-5 top-0 flex flex-col items-center">
                    <div className={cn("mt-5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10", color.dot)} />
                    {idx < schedule.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-white/8" />
                    )}
                  </div>

                  <div className="ml-7">
                    {/* Top row: subject + time */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className={cn("h-3.5 w-3.5", color.text)} />
                        <span className="text-sm font-semibold text-white">
                          {item.subjectName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/45">
                        <Clock className="h-3 w-3" />
                        {timeLabel(item.startTime, item.endTime)}
                      </div>
                    </div>

                    {/* Bottom row: class name + attendance button */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-white/40">
                        <Users className="h-3 w-3" />
                        {item.className}
                      </span>

                      {item.classGroupId && item.subjectId && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 rounded-lg border-white/10 bg-white/5 text-[11px] text-white/60 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
                        >
                          <Link
                            href={`/teacher/attendance/period?classGroupId=${item.classGroupId}&subjectId=${item.subjectId}&date=${todayParam()}`}
                          >
                            Attendance
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
