"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MonthGrid,
  AgendaList,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

type CalendarSummary = {
  id: string;
  name: string;
  color: string | null;
};

type EventRecord = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  color: string | null;
  coverImageUrl: string | null;
  status: string;
  eventType: string;
  isNonTeachingDay: boolean;
};

export default function TeacherCalendarPage() {
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [calendars, setCalendars] = React.useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string>("all");
  const [occurrences, setOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchCalendarData = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const rangeStart = startOfMonth(month);
        const rangeEnd = endOfMonth(month);
        const params = new URLSearchParams({
          from: rangeStart.toISOString(),
          to: rangeEnd.toISOString(),
        });
        if (selectedCalendarId !== "all") {
          params.set("calendarId", selectedCalendarId);
        }

        const res = await fetch(`/api/teacher/calendar?${params}`, {
          cache: "no-store",
          signal,
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load calendar");

        if (signal?.aborted) return;
        setCalendars(json.data.calendars || []);
        setEvents(json.data.events || []);
        setOccurrences(json.data.occurrences || []);
      } catch (error) {
        if (signal?.aborted) return;
        console.error(error);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [month, selectedCalendarId]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    fetchCalendarData(controller.signal);
    return () => controller.abort();
  }, [fetchCalendarData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-brand" />
            <h1 className="text-2xl font-bold">Academic Calendar</h1>
          </div>
          <p className="text-sm text-white/50">Published events for your classes and school.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
            <button
              onClick={() => setView("month")}
              className={view === "month" ? "rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white" : "px-3 py-1 text-xs text-white/50"}
            >
              Month
            </button>
            <button
              onClick={() => setView("agenda")}
              className={view === "agenda" ? "rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white" : "px-3 py-1 text-xs text-white/50"}
            >
              Agenda
            </button>
          </div>
          <Button size="icon" variant="outline" className="border-white/10" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="border-white/10" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-white">{format(month, "MMMM yyyy")}</CardTitle>
            <p className="text-sm text-white/50">Filter by calendar when needed.</p>
          </div>
          <div className="min-w-[220px]">
            <Select
              value={selectedCalendarId}
              onValueChange={(value) => setSelectedCalendarId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All calendars" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All calendars</SelectItem>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white/50">
              Loading calendar...
            </div>
          )}
          {!loading && view === "month" && (
            <MonthGrid month={month} occurrences={occurrences} />
          )}
          {!loading && view === "agenda" && (
            <AgendaList occurrences={occurrences} />
          )}
        </CardContent>
      </Card>

      {!loading && events.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Upcoming Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {events.slice(0, 6).map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{event.title}</div>
                  <Badge className="bg-white/10 text-white/60 text-[10px]">
                    {event.eventType.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-white/50">
                  {format(new Date(event.startDate), "MMM d, yyyy")}
                </div>
                {event.location && (
                  <div className="text-xs text-white/40">{event.location}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
