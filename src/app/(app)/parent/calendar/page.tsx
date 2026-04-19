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
  Repeat,
  School,
  UserCircle2,
  Users,
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function audienceScopeLabel(scope?: string) {
  if (scope === "grades") return "Selected grades";
  if (scope === "classes") return "Selected classes";
  if (scope === "specific_users") return "Private invitation";
  return "School-wide";
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

function recurrenceLabel(
  recurrence: EventRecord["recurrence"] | null | undefined
) {
  if (!recurrence || recurrence.frequency === "none") return "Does not repeat";
  const every = recurrence.interval && recurrence.interval > 1 ? ` every ${recurrence.interval}` : "";
  return `Repeats ${toTitle(recurrence.frequency)}${every}`;
}

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
    scope: "school" | "grades" | "classes" | "specific_users";
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

export default function ParentCalendarPage() {
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [calendars, setCalendars] = React.useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string>("all");
  const [occurrences, setOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [monthEvents, setMonthEvents] = React.useState<EventRecord[]>([]);
  const [upcomingOccurrences, setUpcomingOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [upcomingEvents, setUpcomingEvents] = React.useState<EventRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [upcomingLoading, setUpcomingLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [upcomingError, setUpcomingError] = React.useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = React.useState<CalendarOccurrence | null>(null);
  const [eventModalOpen, setEventModalOpen] = React.useState(false);

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

  const monthEmptyMessage = React.useMemo(() => {
    if (occurrences.length > 0) return null;
    if (upcomingLoading) {
      return `No events in ${format(month, "MMMM yyyy")}. Checking upcoming events...`;
    }
    if (upcomingOccurrences.length > 0) {
      return `No events in ${format(month, "MMMM yyyy")}. Check upcoming events below.`;
    }
    if (upcomingError) {
      return `No events in ${format(month, "MMMM yyyy")}.`;
    }
    return "No published events available yet.";
  }, [month, occurrences.length, upcomingError, upcomingLoading, upcomingOccurrences.length]);

  const openEventDetails = React.useCallback((occurrence: CalendarOccurrence) => {
    setSelectedOccurrence(occurrence);
    setEventModalOpen(true);
  }, []);

  const fetchCalendarData = React.useCallback(async (signal?: AbortSignal) => {
    const rangeStart = startOfMonth(month);
    const rangeEnd = endOfMonth(month);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      });
      if (selectedCalendarId !== "all") {
        params.set("calendarId", selectedCalendarId);
      }

      const fetchRequest = () =>
        fetch(`/api/parent/calendar?${params}`, {
          cache: "no-store",
          signal,
        });

      let res = await fetchRequest();
      if (res.status === 401) {
        // Avoid transient auth races immediately after redirect/login.
        await wait(200);
        if (signal?.aborted) return;
        res = await fetchRequest();
      }

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load calendar");

      if (signal?.aborted) return;
      setCalendars(json.data.calendars || []);
      setMonthEvents(json.data.events || []);
      setOccurrences(json.data.occurrences || []);
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to load calendar");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [month, selectedCalendarId]);

  const fetchUpcomingData = React.useCallback(async (signal?: AbortSignal) => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);

    setUpcomingLoading(true);
    setUpcomingError(null);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (selectedCalendarId !== "all") {
        params.set("calendarId", selectedCalendarId);
      }

      const fetchRequest = () =>
        fetch(`/api/parent/calendar?${params}`, {
          cache: "no-store",
          signal,
        });

      let res = await fetchRequest();
      if (res.status === 401) {
        await wait(200);
        if (signal?.aborted) return;
        res = await fetchRequest();
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load upcoming events");
      }
      if (signal?.aborted) return;

      const sortedUpcoming = (json.data.occurrences || [])
        .filter((occurrence: CalendarOccurrence) =>
          new Date(occurrence.endDate).getTime() >= from.getTime()
        )
        .sort(
          (left: CalendarOccurrence, right: CalendarOccurrence) =>
            new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
        )
        .slice(0, 6);

      setUpcomingEvents(json.data.events || []);
      setUpcomingOccurrences(sortedUpcoming);
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setUpcomingError(
        error instanceof Error ? error.message : "Failed to load upcoming events"
      );
    } finally {
      if (!signal?.aborted) {
        setUpcomingLoading(false);
      }
    }
  }, [selectedCalendarId]);

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
            <h1 className="text-2xl font-bold">School Calendar</h1>
          </div>
          <p className="text-sm text-white/50">Published events and important school dates.</p>
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
            <p className="text-sm text-white/50">Choose a published calendar to filter events.</p>
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
          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
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

      {!loading && monthEmptyMessage && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">
          {monthEmptyMessage}
        </div>
      )}

      {!loading && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Upcoming Events
            </CardTitle>
            <p className="text-xs text-white/45">
              Next {UPCOMING_WINDOW_DAYS} days
            </p>
          </CardHeader>
          <CardContent>
            {upcomingLoading && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Loading upcoming events...
              </div>
            )}
            {!upcomingLoading && upcomingError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                {upcomingError}
              </div>
            )}
            {!upcomingLoading && !upcomingError && upcomingOccurrences.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                No upcoming events in the next {UPCOMING_WINDOW_DAYS} days.
              </div>
            ) : null}
            {!upcomingLoading && !upcomingError && upcomingOccurrences.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingOccurrences.map((occurrence) => {
                  const event = eventById.get(occurrence.eventId);
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
                          backgroundColor: occurrence.color || event?.calendarColor || "#22c55e",
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
                              {event?.calendarName || "Published calendar"}
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

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge className="bg-brand/20 text-brand border border-brand/30 text-[10px]">
                            {audienceScopeLabel(event?.audience?.scope)}
                          </Badge>
                          {event?.isNonTeachingDay && (
                            <Badge className="bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[10px]">
                              Non-teaching day
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
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
        description="Read-only details from the published school calendar."
        className="sm:max-w-2xl"
      >
        {!selectedOccurrence && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Select an event to view details.
          </div>
        )}

        {selectedOccurrence && (
          <div className="space-y-5">
            {selectedEvent?.coverImageUrl && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedEvent.coverImageUrl}
                  alt={selectedOccurrence.title}
                  className="h-44 w-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 text-white/70">
                {toTitle(selectedOccurrence.eventType)}
              </Badge>
              <Badge className="bg-brand/20 text-brand border border-brand/30">
                {audienceScopeLabel(selectedEvent?.audience?.scope)}
              </Badge>
              {selectedEvent?.calendarName && (
                <Badge className="bg-white/10 text-white/70">
                  {selectedEvent.calendarName}
                </Badge>
              )}
            </div>

            {selectedEvent?.description && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                {selectedEvent.description}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Date & Time
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/85">
                  <Clock className="mt-0.5 h-4 w-4 text-brand" />
                  <span>{formatOccurrenceRange(selectedOccurrence)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Venue
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/85">
                  <MapPin className="mt-0.5 h-4 w-4 text-brand" />
                  <span>{selectedOccurrence.location || "Not specified"}</span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Audience
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/85">
                  <Users className="mt-0.5 h-4 w-4 text-brand" />
                  <span>{audienceScopeLabel(selectedEvent?.audience?.scope)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Created By
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/85">
                  <UserCircle2 className="mt-0.5 h-4 w-4 text-brand" />
                  <div>
                    <div>{selectedEvent?.createdBy?.name || "School staff"}</div>
                    {selectedEvent?.createdBy?.email && (
                      <div className="text-xs text-white/55">{selectedEvent.createdBy.email}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedEvent?.recurrence && selectedEvent.recurrence.frequency !== "none" && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Recurrence
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-white/85">
                  <Repeat className="h-4 w-4 text-brand" />
                  <span>{recurrenceLabel(selectedEvent.recurrence)}</span>
                </div>
              </div>
            )}

            {!!selectedEvent && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Visibility Details
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.audience.roles.map((role) => (
                    <Badge
                      key={role}
                      className="bg-white/10 text-white/70 border border-white/15 text-[10px]"
                    >
                      {toTitle(role)}
                    </Badge>
                  ))}
                </div>
                {selectedEvent.audience.scope === "grades" &&
                  selectedEvent.audience.gradeNames.length > 0 && (
                    <div className="text-xs text-white/65">
                      Grades: {selectedEvent.audience.gradeNames.join(", ")}
                    </div>
                  )}
                {selectedEvent.audience.scope === "classes" &&
                  selectedEvent.audience.classGroupNames.length > 0 && (
                    <div className="text-xs text-white/65">
                      Classes: {selectedEvent.audience.classGroupNames.join(", ")}
                    </div>
                  )}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/55">
              <div className="flex items-center gap-2">
                <School className="h-4 w-4 text-brand" />
                <span>
                  Created{" "}
                  {selectedEvent?.createdAt
                    ? format(new Date(selectedEvent.createdAt), "MMM d, yyyy • h:mm a")
                    : "recently"}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
