"use client";

import * as React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEventStatus, CalendarEventType } from "@/lib/academic-calendar/types";

export type CalendarOccurrence = {
  id: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  status: CalendarEventStatus;
  eventType: CalendarEventType;
  isNonTeachingDay: boolean;
  coverImageUrl?: string | null;
  isRecurring: boolean;
};

type DayOccurrence = CalendarOccurrence & {
  segment: "single" | "start" | "middle" | "end";
};

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function groupByDate(occurrences: CalendarOccurrence[]) {
  const map = new Map<string, CalendarOccurrence[]>();
  occurrences.forEach((occurrence) => {
    const key = format(new Date(occurrence.startDate), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(occurrence);
  });
  return map;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function groupByDateSpan(occurrences: CalendarOccurrence[]) {
  const map = new Map<string, DayOccurrence[]>();

  occurrences.forEach((occurrence) => {
    const start = new Date(occurrence.startDate);
    const end = new Date(occurrence.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    const totalDays = Math.max(
      0,
      Math.floor((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000))
    );

    const cursor = new Date(startDay);
    for (let idx = 0; idx <= totalDays; idx += 1) {
      const dayKey = format(cursor, "yyyy-MM-dd");
      const segment: DayOccurrence["segment"] =
        totalDays === 0
          ? "single"
          : idx === 0
            ? "start"
            : idx === totalDays
              ? "end"
              : "middle";

      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)?.push({
        ...occurrence,
        id: `${occurrence.id}:${dayKey}`,
        segment,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
  });

  map.forEach((dayList, key) => {
    map.set(
      key,
      [...dayList].sort((a, b) => {
        const timeDiff =
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (timeDiff !== 0) return timeDiff;

        const order: Record<DayOccurrence["segment"], number> = {
          single: 0,
          start: 0,
          middle: 1,
          end: 2,
        };
        return order[a.segment] - order[b.segment];
      })
    );
  });

  return map;
}

function sortOccurrences(list: CalendarOccurrence[]) {
  return [...list].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

function toFriendlyDateRange(start: string, end: string, allDay: boolean) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (allDay) {
    if (format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
      return format(startDate, "MMM d, yyyy");
    }
    return `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
  }
  if (format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
    return `${format(startDate, "MMM d, yyyy, h:mm a")} – ${format(endDate, "h:mm a")}`;
  }
  return `${format(startDate, "MMM d, yyyy, h:mm a")} – ${format(endDate, "MMM d, yyyy, h:mm a")}`;
}

export function MonthGrid({
  month,
  occurrences,
  onSelectOccurrence,
  onSelectDate,
}: {
  month: Date;
  occurrences: CalendarOccurrence[];
  onSelectOccurrence?: (occurrence: CalendarOccurrence) => void;
  onSelectDate?: (date: Date) => void;
}) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const startWeekday = start.getDay();
  const daysInMonth = end.getDate();

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - (startWeekday - i));
    cells.push({ date, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const date = new Date(end);
    date.setDate(end.getDate() + (cells.length % 7));
    cells.push({ date, inMonth: false });
  }

  const occurrencesByDay = groupByDateSpan(occurrences);

  return (
    <div className="grid grid-cols-7 gap-px rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {WEEKDAYS.map((day) => (
        <div key={day.value} className="bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          {day.label}
        </div>
      ))}
      {cells.map((cell) => {
        const key = format(cell.date, "yyyy-MM-dd");
        const dayEvents = occurrencesByDay.get(key) || [];
        const isToday = format(cell.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

        return (
          <div
            key={key}
            role={cell.inMonth && onSelectDate ? "button" : undefined}
            tabIndex={cell.inMonth && onSelectDate ? 0 : undefined}
            onClick={() => {
              if (cell.inMonth) onSelectDate?.(cell.date);
            }}
            onKeyDown={(e) => {
              if (!cell.inMonth || !onSelectDate) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDate(cell.date);
              }
            }}
            className={cn(
              "min-h-[120px] px-3 py-2 border-t border-white/5 bg-black/20",
              cell.inMonth && onSelectDate && "cursor-pointer hover:bg-black/30",
              !cell.inMonth && "bg-black/10 text-white/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isToday && "text-brand"
                )}
              >
                {cell.date.getDate()}
              </span>
              {dayEvents.some((event) => event.isNonTeachingDay) && (
                <Badge className="bg-rose-500/20 text-rose-200 text-[10px]">No classes</Badge>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {dayEvents.slice(0, 3).map((event) => (
                <button
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOccurrence?.(event);
                  }}
                  className="w-full text-left"
                >
                  <div
                    className="rounded-lg px-2 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: event.color ? `${event.color}22` : "rgba(255,255,255,0.1)",
                      color: event.color || "#fff",
                    }}
                  >
                    <div className="truncate">{event.title}</div>
                    <div className="text-[10px] text-white/60">
                      {event.allDay
                        ? event.segment === "start"
                          ? "Starts"
                          : event.segment === "middle"
                            ? "Continues"
                            : event.segment === "end"
                              ? "Ends"
                              : "All day"
                        : event.segment === "start" || event.segment === "single"
                          ? format(new Date(event.startDate), "h:mm a")
                          : event.segment === "middle"
                            ? "Continues"
                            : `Ends ${format(new Date(event.endDate), "h:mm a")}`}
                    </div>
                  </div>
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-white/40">+{dayEvents.length - 3} more</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgendaList({
  occurrences,
  onSelectOccurrence,
}: {
  occurrences: CalendarOccurrence[];
  onSelectOccurrence?: (occurrence: CalendarOccurrence) => void;
}) {
  const grouped = groupByDate(sortOccurrences(occurrences));
  const days = Array.from(grouped.keys()).sort();

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">
        No events found for this range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const list = grouped.get(day) || [];
        return (
          <div key={day} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="h-4 w-4 text-brand" />
              {format(new Date(day), "MMMM d, yyyy")}
            </div>
            <div className="mt-3 space-y-2">
              {list.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onSelectOccurrence?.(event)}
                  className="w-full text-left rounded-xl border border-white/5 bg-black/20 p-3 transition hover:bg-black/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{event.title}</div>
                      <div className="text-xs text-white/50">
                        {toFriendlyDateRange(event.startDate, event.endDate, event.allDay)}
                      </div>
                    </div>
                    <Badge
                      className="text-[10px]"
                      style={{
                        backgroundColor: event.color ? `${event.color}22` : "rgba(255,255,255,0.1)",
                        color: event.color || "#fff",
                      }}
                    >
                      {event.eventType.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
