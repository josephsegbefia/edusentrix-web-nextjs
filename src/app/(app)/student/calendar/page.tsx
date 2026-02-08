"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Repeat,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  AgendaList,
  MonthGrid,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type CalendarSummary = {
  id: string;
  name: string;
  color: string | null;
};

type EventRecord = {
  id: string;
  calendarId: string;
  calendarName: string | null;
  calendarColor: string | null;
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
  audience: {
    scope: "school" | "grades" | "classes";
    gradeIds: string[];
    classGroupIds: string[];
    gradeNames: string[];
    classGroupNames: string[];
    roles: string[];
  };
  recurrence: {
    frequency: string;
    interval?: number;
    until?: string | null;
    count?: number | null;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatOccurrenceRange(occurrence: CalendarOccurrence) {
  const start = new Date(occurrence.startDate);
  const end = new Date(occurrence.endDate);
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");

  if (occurrence.allDay) {
    return sameDay
      ? format(start, "EEE, MMM d, yyyy")
      : `${format(start, "EEE, MMM d")} - ${format(end, "EEE, MMM d, yyyy")}`;
  }

  if (sameDay) {
    return `${format(start, "EEE, MMM d, yyyy • h:mm a")} - ${format(end, "h:mm a")}`;
  }

  return `${format(start, "EEE, MMM d, yyyy • h:mm a")} - ${format(end, "EEE, MMM d, yyyy • h:mm a")}`;
}

const UPCOMING_WINDOW_DAYS = 60;

export default function StudentCalendarPage() {
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [calendars, setCalendars] = React.useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState("all");
  const [occurrences, setOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [monthEvents, setMonthEvents] = React.useState<EventRecord[]>([]);
  const [upcomingOccurrences, setUpcomingOccurrences] = React.useState<
    CalendarOccurrence[]
  >([]);
  const [upcomingEvents, setUpcomingEvents] = React.useState<EventRecord[]>([]);
  const [selectedOccurrence, setSelectedOccurrence] =
    React.useState<CalendarOccurrence | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [upcomingLoading, setUpcomingLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [upcomingError, setUpcomingError] = React.useState<string | null>(null);

  const eventById = React.useMemo(() => {
    const map = new Map<string, EventRecord>();
    monthEvents.forEach((event) => map.set(event.id, event));
    upcomingEvents.forEach((event) => map.set(event.id, event));
    return map;
  }, [monthEvents, upcomingEvents]);

  const selectedEvent = React.useMemo(
    () => (selectedOccurrence ? eventById.get(selectedOccurrence.eventId) || null : null),
    [eventById, selectedOccurrence]
  );

  const monthLabel = format(month, "MMMM yyyy");

  const fetchMonthData = React.useCallback(async (signal?: AbortSignal) => {
    const from = startOfMonth(month).toISOString();
    const to = endOfMonth(month).toISOString();

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (selectedCalendarId !== "all") {
        params.set("calendarId", selectedCalendarId);
      }

      const response = await fetch(`/api/student/calendar?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load calendar");
      }

      if (signal?.aborted) return;

      setCalendars(payload.data.calendars || []);
      setMonthEvents(payload.data.events || []);
      setOccurrences(payload.data.occurrences || []);
    } catch (fetchError) {
      if (signal?.aborted) return;
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load calendar"
      );
      setOccurrences([]);
      setMonthEvents([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [month, selectedCalendarId]);

  const fetchUpcomingData = React.useCallback(async (signal?: AbortSignal) => {
    const fromDate = new Date();
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + UPCOMING_WINDOW_DAYS);

    setUpcomingLoading(true);
    setUpcomingError(null);
    try {
      const params = new URLSearchParams({
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      });
      if (selectedCalendarId !== "all") {
        params.set("calendarId", selectedCalendarId);
      }

      const response = await fetch(`/api/student/calendar?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load upcoming events");
      }

      if (signal?.aborted) return;

      const sortedUpcoming = (payload.data.occurrences || [])
        .filter(
          (occurrence: CalendarOccurrence) =>
            new Date(occurrence.endDate).getTime() >= fromDate.getTime()
        )
        .sort(
          (left: CalendarOccurrence, right: CalendarOccurrence) =>
            new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
        )
        .slice(0, 6);

      setUpcomingEvents(payload.data.events || []);
      setUpcomingOccurrences(sortedUpcoming);
    } catch (fetchError) {
      if (signal?.aborted) return;
      setUpcomingError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load upcoming events"
      );
      setUpcomingOccurrences([]);
      setUpcomingEvents([]);
    } finally {
      if (!signal?.aborted) setUpcomingLoading(false);
    }
  }, [selectedCalendarId]);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetchMonthData(controller.signal);
    return () => controller.abort();
  }, [fetchMonthData]);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetchUpcomingData(controller.signal);
    return () => controller.abort();
  }, [fetchUpcomingData]);

  React.useEffect(() => {
    if (!selectedOccurrence) return;
    const stillExists = [...occurrences, ...upcomingOccurrences].some(
      (occurrence) => occurrence.id === selectedOccurrence.id
    );
    if (!stillExists) {
      setSelectedOccurrence(null);
    }
  }, [occurrences, selectedOccurrence, upcomingOccurrences]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <CalendarDays className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl text-white">Calendar</CardTitle>
            <p className="mt-1 text-sm text-white/65">
              View school events relevant to your class and subjects.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <PremiumSelect
              value={selectedCalendarId}
              onValueChange={setSelectedCalendarId}
            >
              <PremiumSelectTrigger className="w-full sm:w-64">
                <PremiumSelectValue placeholder="All calendars" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All calendars</PremiumSelectItem>
                {calendars.map((calendar) => (
                  <PremiumSelectItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <Button
              variant="outline"
              onClick={() => void fetchMonthData()}
              disabled={isLoading}
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 xl:col-span-2">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((prev) => addMonths(prev, -1))}
                  className="h-8 w-8 border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="min-w-[140px] text-center text-sm font-semibold text-white">
                  {monthLabel}
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((prev) => addMonths(prev, 1))}
                  className="h-8 w-8 border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                <button
                  onClick={() => setView("month")}
                  className={
                    view === "month"
                      ? "rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                      : "px-3 py-1 text-xs text-white/50"
                  }
                >
                  Month
                </button>
                <button
                  onClick={() => setView("agenda")}
                  className={
                    view === "agenda"
                      ? "rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                      : "px-3 py-1 text-xs text-white/50"
                  }
                >
                  Agenda
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[420px] rounded-2xl" />
            ) : error ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            ) : occurrences.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
                No events found for {monthLabel}.
              </div>
            ) : view === "month" ? (
              <MonthGrid
                month={month}
                occurrences={occurrences}
                onSelectOccurrence={setSelectedOccurrence}
              />
            ) : (
              <AgendaList
                occurrences={occurrences}
                onSelectOccurrence={setSelectedOccurrence}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader>
              <CardTitle className="text-lg text-white">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              ) : upcomingError ? (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">
                  {upcomingError}
                </div>
              ) : upcomingOccurrences.length === 0 ? (
                <p className="text-sm text-white/60">
                  No upcoming events in the next {UPCOMING_WINDOW_DAYS} days.
                </p>
              ) : (
                upcomingOccurrences.map((occurrence) => {
                  const event = eventById.get(occurrence.eventId);
                  return (
                    <button
                      key={occurrence.id}
                      onClick={() => setSelectedOccurrence(occurrence)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                    >
                      <p className="text-sm font-medium text-white">{occurrence.title}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {format(new Date(occurrence.startDate), "EEE, MMM d • h:mm a")}
                      </p>
                      {event?.calendarName && (
                        <p className="mt-1 text-xs text-white/45">{event.calendarName}</p>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader>
              <CardTitle className="text-lg text-white">Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedOccurrence || !selectedEvent ? (
                <p className="text-sm text-white/60">
                  Select an event to view full details.
                </p>
              ) : (
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-2">
                    <CalendarRange className="mt-0.5 h-4 w-4 text-brand" />
                    <div>
                      <p className="font-medium text-white">{selectedEvent.title}</p>
                      <p className="text-white/55">
                        {formatOccurrenceRange(selectedOccurrence)}
                      </p>
                    </div>
                  </div>
                  {selectedEvent.calendarName && (
                    <div className="flex items-center gap-2 text-white/60">
                      <Badge variant="outline" className="border-white/20 bg-white/5">
                        {selectedEvent.calendarName}
                      </Badge>
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-white/65">
                      <MapPin className="h-4 w-4 text-white/40" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-white/65">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className="capitalize">
                      {selectedEvent.eventType.replaceAll("_", " ")}
                    </span>
                  </div>
                  {selectedOccurrence.isRecurring && (
                    <div className="flex items-center gap-2 text-white/65">
                      <Repeat className="h-4 w-4 text-white/40" />
                      <span>Recurring event</span>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                      {selectedEvent.description}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
