"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListFilter,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Modal } from "@/components/ui/responsive-modal";
import { premiumMenuItem, premiumSelectContent } from "@/components/ui/premium";
import {
  AgendaList,
  MonthGrid,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";
import { cn } from "@/lib/utils";

type PeriodOption = {
  id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
};

type CalendarSummary = {
  id: string;
  name: string;
  description: string | null;
  academicPeriodId: string | null;
  color: string | null;
  isPublished: boolean;
};

type EventRecord = {
  id: string;
  calendarId: string;
  academicPeriodId: string | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  color: string | null;
  coverImageUrl: string | null;
  status: CalendarOccurrence["status"];
  eventType: CalendarOccurrence["eventType"];
  isNonTeachingDay: boolean;
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

function startOfDayValue(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDayValue(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function eventFallsWithinPeriod(start: Date, end: Date, period: PeriodOption) {
  const periodStart = startOfDayValue(new Date(period.startDate));
  const periodEnd = endOfDayValue(new Date(period.endDate));
  return start >= periodStart && end <= periodEnd;
}

function describePeriod(period: PeriodOption | null) {
  return period ? `${period.yearLabel} · ${period.term}` : "No academic period";
}

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
    return `${format(start, "EEE, MMM d, yyyy, h:mm a")} - ${format(end, "h:mm a")}`;
  }

  return `${format(start, "EEE, MMM d, yyyy, h:mm a")} - ${format(end, "EEE, MMM d, yyyy, h:mm a")}`;
}

export default function TeacherCalendarPage() {
  const [calendar, setCalendar] = React.useState<CalendarSummary | null>(null);
  const [events, setEvents] = React.useState<EventRecord[]>([]);
  const [occurrences, setOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [periodOptions, setPeriodOptions] = React.useState<PeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState("");
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [loading, setLoading] = React.useState(false);
  const [selectedOccurrence, setSelectedOccurrence] =
    React.useState<CalendarOccurrence | null>(null);
  const [eventModalOpen, setEventModalOpen] = React.useState(false);

  const selectedPeriod =
    periodOptions.find((period) => period.id === selectedPeriodId) || null;

  const eventById = React.useMemo(() => {
    const map = new Map<string, EventRecord>();
    events.forEach((event) => map.set(event.id, event));
    return map;
  }, [events]);

  const selectedEvent = selectedOccurrence
    ? eventById.get(selectedOccurrence.eventId) || null
    : null;

  const inPeriodEvents = React.useMemo(
    () =>
      selectedPeriod
        ? events.filter((event) =>
            eventFallsWithinPeriod(
              new Date(event.startDate),
              new Date(event.endDate),
              selectedPeriod
            )
          )
        : events,
    [events, selectedPeriod]
  );

  const outsidePeriodEvents = React.useMemo(
    () =>
      selectedPeriod
        ? events.filter(
            (event) =>
              event.academicPeriodId === selectedPeriod.id &&
              !eventFallsWithinPeriod(
                new Date(event.startDate),
                new Date(event.endDate),
                selectedPeriod
              )
          )
        : [],
    [events, selectedPeriod]
  );

  const rangeStart = React.useMemo(() => startOfMonth(month), [month]);
  const rangeEnd = React.useMemo(() => endOfMonth(month), [month]);

  const fetchCalendar = React.useCallback(
    async (periodId?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: rangeStart.toISOString(),
          to: rangeEnd.toISOString(),
        });
        if (periodId) params.set("academicPeriodId", periodId);

        const res = await fetch(`/api/teacher/calendar?${params}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load calendar");
        }

        const data = json.data as {
          calendar: CalendarSummary | null;
          events: EventRecord[];
          occurrences: CalendarOccurrence[];
          meta: {
            periods: PeriodOption[];
            selectedPeriod: PeriodOption | null;
          };
        };

        setCalendar(data.calendar);
        setEvents(data.events || []);
        setOccurrences(data.occurrences || []);
        setPeriodOptions(data.meta.periods || []);

        const nextPeriodId = data.meta.selectedPeriod?.id || "";
        setSelectedPeriodId((current) => current || nextPeriodId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load calendar");
        setCalendar(null);
        setEvents([]);
        setOccurrences([]);
      } finally {
        setLoading(false);
      }
    },
    [rangeEnd, rangeStart]
  );

  React.useEffect(() => {
    fetchCalendar(selectedPeriodId || undefined);
  }, [fetchCalendar, selectedPeriodId]);

  /** Only snap the grid to the period start when the user picks a different period — not on every refetch (periodOptions gets a new array and would fight month navigation). */
  const syncedVisibleMonthForPeriodIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!selectedPeriodId) {
      syncedVisibleMonthForPeriodIdRef.current = null;
      return;
    }
    const period = periodOptions.find((p) => p.id === selectedPeriodId);
    if (!period) return;
    if (syncedVisibleMonthForPeriodIdRef.current === selectedPeriodId) return;

    syncedVisibleMonthForPeriodIdRef.current = selectedPeriodId;
    setMonth(startOfMonth(new Date(period.startDate)));
  }, [selectedPeriodId, periodOptions]);

  const openEventDetails = React.useCallback((occurrence: CalendarOccurrence) => {
    setSelectedOccurrence(occurrence);
    setEventModalOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-brand" />
            <h1 className="text-2xl font-bold text-white">Academic Calendar</h1>
          </div>
          <p className="text-sm text-white/50">
            Published events shared with you by the school.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                School Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="text-sm font-semibold text-white">
                  {calendar?.name || "No calendar for this term"}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {calendar
                    ? "Events visible to teachers are shown here."
                    : "An admin has not published a calendar for this term yet."}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                Filters
              </CardTitle>
              <ListFilter className="h-4 w-4 text-white/40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-white/50">Academic period</label>
                <Select
                  value={selectedPeriodId || "none"}
                  onValueChange={(value) => setSelectedPeriodId(value === "none" ? "" : value)}
                >
                  <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent className={premiumSelectContent}>
                    {periodOptions.map((period) => (
                      <SelectItem key={period.id} value={period.id} className={premiumMenuItem}>
                        {period.yearLabel} · {period.term}
                        {period.isCurrent ? " · Current" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-white/60">
                {inPeriodEvents.length} event{inPeriodEvents.length === 1 ? "" : "s"} inside this period
              </div>
              {outsidePeriodEvents.length > 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {outsidePeriodEvents.length} event
                  {outsidePeriodEvents.length === 1 ? "" : "s"} outside this period&apos;s dates.
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs text-white/50">Jump to month</label>
                <CustomDatePicker
                  value={rangeStart}
                  onChange={(date) => date && setMonth(startOfMonth(date))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-white">
                  {format(month, "MMMM yyyy")}
                </CardTitle>
                <p className="text-sm text-white/50">{describePeriod(selectedPeriod)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      view === "month" ? "bg-white/10 text-white" : "text-white/50"
                    )}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("agenda")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      view === "agenda" ? "bg-white/10 text-white" : "text-white/50"
                    )}
                  >
                    Agenda
                  </button>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="border-white/10"
                  onClick={() => setMonth(addMonths(month, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="border-white/10"
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white/50">
                  Loading calendar...
                </div>
              )}

              {!loading && !calendar && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-white/60">
                  No published calendar is available for {describePeriod(selectedPeriod)}.
                </div>
              )}

              {!loading && calendar && view === "month" && (
                <MonthGrid
                  month={month}
                  occurrences={occurrences}
                  onSelectOccurrence={openEventDetails}
                />
              )}

              {!loading && calendar && view === "agenda" && (
                <AgendaList
                  occurrences={occurrences}
                  onSelectOccurrence={openEventDetails}
                />
              )}

              {!loading && outsidePeriodEvents.length > 0 && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-50">
                        Outside the period dates
                      </h3>
                      <p className="mt-1 text-xs text-amber-100/75">
                        These events belong to {describePeriod(selectedPeriod)} but fall outside the official period window.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
        {!selectedOccurrence ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Select an event to view details.
          </div>
        ) : (
          <div className="space-y-4 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 text-white/70">
                {toTitle(selectedOccurrence.eventType)}
              </Badge>
              {selectedOccurrence.isNonTeachingDay && (
                <Badge className="border border-rose-500/40 bg-rose-500/20 text-rose-100">
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
