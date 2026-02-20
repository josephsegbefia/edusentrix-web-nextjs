"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MonthGrid,
  AgendaList,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/responsive-modal";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

const UPCOMING_WINDOW_DAYS = 90;

function toTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [upcomingOccurrences, setUpcomingOccurrences] = React.useState<
    CalendarOccurrence[]
  >([]);
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [upcomingLoading, setUpcomingLoading] = React.useState(false);
  const [upcomingError, setUpcomingError] = React.useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] =
    React.useState<CalendarOccurrence | null>(null);
  const [eventModalOpen, setEventModalOpen] = React.useState(false);

  const eventById = React.useMemo(() => {
    const map = new Map<string, EventRecord>();
    events.forEach((event) => map.set(event.id, event));
    return map;
  }, [events]);

  const calendarById = React.useMemo(() => {
    const map = new Map<string, CalendarSummary>();
    calendars.forEach((calendar) => map.set(calendar.id, calendar));
    return map;
  }, [calendars]);

  const selectedEvent = React.useMemo(
    () => (selectedOccurrence ? eventById.get(selectedOccurrence.eventId) || null : null),
    [eventById, selectedOccurrence]
  );

  const upcomingHighlights = React.useMemo(
    () => upcomingOccurrences.slice(0, 6),
    [upcomingOccurrences]
  );

  const openEventDetails = React.useCallback((occurrence: CalendarOccurrence) => {
    setSelectedOccurrence(occurrence);
    setEventModalOpen(true);
  }, []);

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

  const fetchUpcomingData = React.useCallback(
    async (signal?: AbortSignal) => {
      setUpcomingLoading(true);
      setUpcomingError(null);
      try {
        const rangeStart = new Date();
        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + UPCOMING_WINDOW_DAYS);

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
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load upcoming events");
        }

        if (signal?.aborted) return;
        setEvents(json.data.events || []);
        const sorted = (json.data.occurrences || []).sort(
          (a: CalendarOccurrence, b: CalendarOccurrence) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        setUpcomingOccurrences(sorted);
      } catch (error) {
        if (signal?.aborted) return;
        console.error(error);
        setUpcomingOccurrences([]);
        setUpcomingError(
          error instanceof Error ? error.message : "Failed to load upcoming events"
        );
      } finally {
        if (!signal?.aborted) {
          setUpcomingLoading(false);
        }
      }
    },
    [selectedCalendarId]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    fetchCalendarData(controller.signal);
    return () => controller.abort();
  }, [fetchCalendarData]);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchUpcomingData(controller.signal);
    return () => controller.abort();
  }, [fetchUpcomingData]);

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
            <PremiumSelect
              value={selectedCalendarId}
              onValueChange={(value) => setSelectedCalendarId(value)}
            >
              <PremiumSelectTrigger>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white/50">
              Loading calendar...
            </div>
          )}
          {!loading && view === "month" && (
            <MonthGrid
              month={month}
              occurrences={occurrences}
              onSelectOccurrence={openEventDetails}
            />
          )}
          {!loading && view === "agenda" && (
            <AgendaList
              occurrences={occurrences}
              onSelectOccurrence={openEventDetails}
            />
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Upcoming Highlights
            </CardTitle>
            <p className="text-xs text-white/45">
              Next {UPCOMING_WINDOW_DAYS} days
            </p>
          </CardHeader>
          <CardContent>
            {upcomingLoading ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Loading upcoming highlights...
              </div>
            ) : upcomingError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                {upcomingError}
              </div>
            ) : upcomingHighlights.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                No upcoming highlights right now.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingHighlights.map((occurrence) => {
                  const event = eventById.get(occurrence.eventId);
                  const calendar = event
                    ? calendarById.get(event.calendarId)
                    : undefined;
                  return (
                    <button
                      key={occurrence.id}
                      type="button"
                      onClick={() => openEventDetails(occurrence)}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-lg hover:shadow-black/30"
                    >
                      <div
                        className="absolute left-0 top-0 h-full w-1"
                        style={{
                          backgroundColor:
                            occurrence.color ||
                            event?.color ||
                            calendar?.color ||
                            "#22c55e",
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-70" />
                      <div className="relative z-10 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {occurrence.title}
                            </div>
                            <div className="mt-1 text-xs text-white/55">
                              {calendar?.name || "Published calendar"}
                            </div>
                          </div>
                          <Badge className="bg-white/10 text-white/70 text-[10px]">
                            {toTitle(occurrence.eventType)}
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs text-white/65">
                          <div className="flex items-center gap-1.5">
                            <CalendarRange className="h-3.5 w-3.5 text-brand" />
                            <span>{formatOccurrenceRange(occurrence)}</span>
                          </div>
                          {occurrence.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-white/45" />
                              <span>{occurrence.location}</span>
                            </div>
                          )}
                        </div>

                        {occurrence.isNonTeachingDay && (
                          <div className="flex items-center gap-2 pt-1">
                            <Badge className="bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[10px]">
                              Non-teaching day
                            </Badge>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        open={eventModalOpen}
        onOpenChange={(open) => {
          setEventModalOpen(open);
          if (!open) setSelectedOccurrence(null);
        }}
        title={selectedOccurrence?.title || "Event details"}
        description="Published details for this calendar event."
        className="sm:max-w-2xl"
      >
        {!selectedOccurrence && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Select an event to view details.
          </div>
        )}

        {selectedOccurrence && (
          <div className="space-y-4 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 text-white/70">
                {toTitle(selectedOccurrence.eventType)}
              </Badge>
              {selectedOccurrence.isNonTeachingDay && (
                <Badge className="bg-rose-500/20 text-rose-100 border border-rose-500/40">
                  Non-teaching day
                </Badge>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-2">
                <CalendarRange className="mt-0.5 h-4 w-4 text-brand" />
                <div>
                  <p className="font-medium text-white">
                    {selectedEvent?.title || selectedOccurrence.title}
                  </p>
                  <p className="text-white/55">
                    {formatOccurrenceRange(selectedOccurrence)}
                  </p>
                </div>
              </div>

              {(selectedEvent?.location || selectedOccurrence.location) && (
                <div className="flex items-center gap-2 text-white/65">
                  <MapPin className="h-4 w-4 text-white/40" />
                  <span>{selectedEvent?.location || selectedOccurrence.location}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-white/65">
                <Clock className="h-4 w-4 text-white/40" />
                <span>{selectedOccurrence.allDay ? "All-day event" : "Timed event"}</span>
              </div>

              {selectedEvent && (
                <div className="flex items-center gap-2 text-white/60">
                  <Badge variant="outline" className="border-white/20 bg-white/5">
                    {calendarById.get(selectedEvent.calendarId)?.name || "Published calendar"}
                  </Badge>
                </div>
              )}

              {selectedEvent?.description && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/75">
                  {selectedEvent.description}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
