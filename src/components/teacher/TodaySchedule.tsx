"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clock,
  History,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGhanaDateString } from "@/lib/time/ghana";
import type { TeacherDashboardScheduleSlot } from "@/hooks/teacher/useTeacherDashboard";

const periodColors = [
  { border: "border-sky-500/25", dot: "bg-sky-400", text: "text-sky-300", bg: "from-sky-500/8" },
  { border: "border-violet-500/25", dot: "bg-violet-400", text: "text-violet-300", bg: "from-violet-500/8" },
  { border: "border-emerald-500/25", dot: "bg-emerald-400", text: "text-emerald-300", bg: "from-emerald-500/8" },
  { border: "border-amber-500/25", dot: "bg-amber-400", text: "text-amber-300", bg: "from-amber-500/8" },
  { border: "border-rose-500/25", dot: "bg-rose-400", text: "text-rose-300", bg: "from-rose-500/8" },
  { border: "border-indigo-500/25", dot: "bg-indigo-400", text: "text-indigo-300", bg: "from-indigo-500/8" },
];

type ScheduleView = "upcoming" | "later" | "past";

type WeekScheduleDay = {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  slots: TeacherDashboardScheduleSlot[];
};

type TodayScheduleProps = {
  date?: string;
  schedule?: TeacherDashboardScheduleSlot[];
  weekSchedule?: {
    weekStart: string;
    weekEnd: string;
    days: WeekScheduleDay[];
  } | null;
  loading?: boolean;
};

type SlotTiming = "past" | "current" | "upcoming";

function toMinutes(time?: string | null) {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((v) => Number(v));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function getGhanaNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function getSlotTiming(slot: TeacherDashboardScheduleSlot, todayYmd: string, nowMinutes: number): SlotTiming {
  if (slot.date < todayYmd) return "past";
  if (slot.date > todayYmd) return "upcoming";

  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  if (start == null || end == null) return "upcoming";
  if (nowMinutes >= end) return "past";
  if (nowMinutes >= start) return "current";
  return "upcoming";
}

function timeLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return "Time TBA";
  if (start && end) return `${start} – ${end}`;
  return start || end || "Time TBA";
}

function formatDayHeading(dateYmd: string, isToday: boolean) {
  const date = new Date(`${dateYmd}T12:00:00`);
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return isToday ? `Today · ${label}` : label;
}

function formatWeekRange(weekStart: string, weekEnd: string) {
  const start = new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const end = new Date(`${weekEnd}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${start} – ${end}`;
}

function flattenWeekSlots(weekSchedule: TodayScheduleProps["weekSchedule"]) {
  if (!weekSchedule?.days?.length) return [];
  return weekSchedule.days.flatMap((day) =>
    day.slots.map((slot) => ({
      ...slot,
      isToday: day.isToday,
    }))
  );
}

function groupSlotsByDay(
  slots: Array<TeacherDashboardScheduleSlot & { isToday?: boolean }>,
  direction: "asc" | "desc"
) {
  const groups = new Map<string, { date: string; isToday: boolean; slots: TeacherDashboardScheduleSlot[] }>();
  for (const slot of slots) {
    const existing = groups.get(slot.date) || {
      date: slot.date,
      isToday: Boolean(slot.isToday),
      slots: [],
    };
    existing.slots.push(slot);
    groups.set(slot.date, existing);
  }

  return Array.from(groups.values())
    .sort((a, b) =>
      direction === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    )
    .map((group) => ({
      ...group,
      slots: group.slots.sort((a, b) => (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0)),
    }));
}

function DayGroupSection({
  groups,
  timing,
  emptyMessage,
}: {
  groups: Array<{ date: string; isToday: boolean; slots: TeacherDashboardScheduleSlot[] }>;
  timing: SlotTiming;
  emptyMessage: string;
}) {
  if (!groups.length) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 text-center text-sm text-white/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
            {formatDayHeading(group.date, group.isToday)}
          </p>
          <div className="space-y-2.5">
            {group.slots.map((item, idx) => (
              <ScheduleSlotCard
                key={`${item.classGroupId}-${item.subjectId}-${item.startTime || "tba"}-${item.date}`}
                item={item}
                colorIndex={idx}
                timing={timing}
                attendanceDate={item.date}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleSlotCard({
  item,
  colorIndex,
  timing,
  attendanceDate,
  highlight = false,
}: {
  item: TeacherDashboardScheduleSlot;
  colorIndex: number;
  timing: SlotTiming;
  attendanceDate: string;
  highlight?: boolean;
}) {
  const color = periodColors[colorIndex % periodColors.length];
  const isPast = timing === "past";
  const isCurrent = timing === "current";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-linear-to-r to-transparent p-4 transition-all duration-300",
        highlight
          ? "border-emerald-400/35 from-emerald-500/12 shadow-lg shadow-emerald-950/20"
          : cn(color.border, color.bg, !isPast && "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20"),
        isPast && "border-white/8 from-white/[0.02] opacity-70"
      )}
    >
      {isCurrent ? (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          Happening now
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className={cn("h-3.5 w-3.5 shrink-0", isCurrent ? "text-emerald-300" : color.text)} />
          <span className={cn("truncate text-sm font-semibold", isPast ? "text-white/70" : "text-white")}>
            {item.subjectName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/45">
          <Clock className="h-3 w-3" />
          {timeLabel(item.startTime, item.endTime)}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-white/40">
          <Users className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.className}</span>
        </span>

        {item.classGroupId && item.subjectId && !isPast ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 rounded-lg border-white/10 bg-white/5 text-[11px] text-white/60 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Link
              href={`/teacher/attendance/period?classGroupId=${item.classGroupId}&subjectId=${item.subjectId}&date=${attendanceDate}`}
            >
              Attendance
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TodaySchedule({ date, schedule = [], weekSchedule, loading }: TodayScheduleProps) {
  const [view, setView] = React.useState<ScheduleView>("upcoming");
  const todayYmd = getGhanaDateString();
  const nowMinutes = getGhanaNowMinutes();

  const allSlots = React.useMemo(() => {
    const fromWeek = flattenWeekSlots(weekSchedule);
    if (fromWeek.length) return fromWeek;
    return schedule.map((slot) => ({
      ...slot,
      date: slot.date || todayYmd,
      isToday: true,
    }));
  }, [weekSchedule, schedule, todayYmd]);

  const classified = React.useMemo(() => {
    const rows = allSlots.map((slot) => ({
      slot,
      timing: getSlotTiming(slot, todayYmd, nowMinutes),
    }));
    rows.sort((a, b) => {
      if (a.slot.date !== b.slot.date) return a.slot.date.localeCompare(b.slot.date);
      return (toMinutes(a.slot.startTime) ?? 0) - (toMinutes(b.slot.startTime) ?? 0);
    });
    return rows;
  }, [allSlots, todayYmd, nowMinutes]);

  const upcomingSlots = classified.filter(({ timing }) => timing === "upcoming" || timing === "current");
  const pastSlots = classified.filter(({ timing }) => timing === "past");

  const todayUpcoming = upcomingSlots.filter(({ slot }) => slot.date === todayYmd);
  const laterWeekUpcoming = upcomingSlots.filter(({ slot }) => slot.date > todayYmd);

  const currentSlot = todayUpcoming.find(({ timing }) => timing === "current")?.slot ?? null;
  const nextSlot = todayUpcoming.find(({ timing }) => timing === "upcoming")?.slot ?? null;

  const laterTodayGroups = groupSlotsByDay(
    todayUpcoming
      .map(({ slot }) => slot)
      .filter((slot) => slot !== currentSlot && slot !== nextSlot),
    "asc"
  );
  const laterWeekGroups = groupSlotsByDay(
    laterWeekUpcoming.map(({ slot }) => slot),
    "asc"
  );
  const pastGroups = groupSlotsByDay(
    pastSlots.map(({ slot }) => slot),
    "desc"
  );

  const displayDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "Today";

  const weekRangeLabel =
    weekSchedule?.weekStart && weekSchedule?.weekEnd
      ? formatWeekRange(weekSchedule.weekStart, weekSchedule.weekEnd)
      : null;

  const totalThisWeek = allSlots.length;
  const todayUpcomingCount = todayUpcoming.length;
  const laterWeekCount = laterWeekUpcoming.length;
  const pastCount = pastSlots.length;
  const laterWeekDayCount = laterWeekGroups.length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-500/10 via-sky-500/5 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 border-b border-white/8 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-sky-500/20">
              <CalendarDays className="h-4 w-4 text-sky-200" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Your Schedule</h3>
              <p className="text-[11px] text-white/40">
                {weekRangeLabel ? `${weekRangeLabel} · ${displayDate}` : displayDate}
              </p>
            </div>
          </div>

          {!loading && totalThisWeek > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-white/50">
              {totalThisWeek} this week
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("upcoming")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "upcoming"
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white/75"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Today
            {todayUpcomingCount > 0 ? (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{todayUpcomingCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setView("later")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "later"
                ? "border-violet-400/30 bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white/75"
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Later this week
            {laterWeekCount > 0 ? (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{laterWeekCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setView("past")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "past"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white/75"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Past
            {pastCount > 0 ? (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{pastCount}</span>
            ) : null}
          </button>
        </div>
      </div>

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
        ) : totalThisWeek === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Clock className="h-6 w-6 text-white/25" />
            </div>
            <p className="text-sm font-medium text-white/50">No classes scheduled this week</p>
            <p className="mt-1 text-xs text-white/30">
              When your school publishes a timetable, your lessons will appear here.
            </p>
          </div>
        ) : view === "upcoming" ? (
          <div className="space-y-4">
            {currentSlot ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80">
                  In progress
                </p>
                <ScheduleSlotCard
                  item={currentSlot}
                  colorIndex={0}
                  timing="current"
                  attendanceDate={currentSlot.date}
                  highlight
                />
              </div>
            ) : null}

            {nextSlot && nextSlot !== currentSlot ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300/80">
                  Up next
                </p>
                <ScheduleSlotCard
                  item={nextSlot}
                  colorIndex={1}
                  timing="upcoming"
                  attendanceDate={nextSlot.date}
                  highlight
                />
              </div>
            ) : null}

            {laterTodayGroups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                  Later today
                </p>
                <div className="space-y-2.5">
                  {laterTodayGroups[0]?.slots.map((item, idx) => (
                    <ScheduleSlotCard
                      key={`${item.classGroupId}-${item.subjectId}-${item.startTime || "tba"}-${item.date}`}
                      item={item}
                      colorIndex={idx + 2}
                      timing="upcoming"
                      attendanceDate={item.date}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!currentSlot && !nextSlot && laterTodayGroups.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 text-center">
                <p className="text-sm text-white/50">No more classes scheduled for today.</p>
                {laterWeekCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setView("later")}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-300 transition-colors hover:text-violet-200"
                  >
                    View {laterWeekCount} class{laterWeekCount !== 1 ? "es" : ""} later this week
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : laterWeekCount > 0 ? (
              <button
                type="button"
                onClick={() => setView("later")}
                className="flex w-full items-center justify-between rounded-xl border border-violet-400/20 bg-violet-500/8 px-4 py-3 text-left transition-colors hover:border-violet-400/35 hover:bg-violet-500/12"
              >
                <div>
                  <p className="text-xs font-medium text-violet-100">Later this week</p>
                  <p className="mt-0.5 text-[11px] text-violet-200/60">
                    {laterWeekCount} class{laterWeekCount !== 1 ? "es" : ""} across {laterWeekDayCount} day
                    {laterWeekDayCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-violet-300/70" />
              </button>
            ) : null}
          </div>
        ) : view === "later" ? (
          <div className="space-y-4">
            {laterWeekCount > 0 ? (
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/8 px-4 py-3">
                <p className="text-xs font-medium text-violet-100">
                  {laterWeekCount} upcoming class{laterWeekCount !== 1 ? "es" : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-violet-200/60">
                  {weekRangeLabel
                    ? `Scheduled after today · ${weekRangeLabel}`
                    : "Scheduled after today"}
                </p>
              </div>
            ) : null}
            <DayGroupSection
              groups={laterWeekGroups}
              timing="upcoming"
              emptyMessage="No classes scheduled after today this week."
            />
          </div>
        ) : (
          <DayGroupSection
            groups={pastGroups}
            timing="past"
            emptyMessage="No completed classes yet this week."
          />
        )}
      </div>
    </div>
  );
}
