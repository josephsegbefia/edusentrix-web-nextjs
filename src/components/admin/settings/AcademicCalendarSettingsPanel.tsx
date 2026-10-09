"use client";

import * as React from "react";
import Link from "next/link";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AgendaList,
  MonthGrid,
  type CalendarOccurrence,
} from "@/components/academic-calendar/CalendarViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type CalendarSummary = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isPublished: boolean;
  canEdit?: boolean;
};

function toCalendarSummary(raw: unknown): CalendarSummary {
  const item = raw as Partial<CalendarSummary> & { _id?: string };
  return {
    id: String(item.id ?? item._id ?? ""),
    name: String(item.name ?? "Academic Calendar"),
    description: item.description ?? null,
    color: item.color ?? null,
    isPublished: Boolean(item.isPublished),
    canEdit: item.canEdit,
  };
}

export function AcademicCalendarSettingsPanel() {
  const [calendars, setCalendars] = React.useState<CalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState("");
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [occurrences, setOccurrences] = React.useState<CalendarOccurrence[]>([]);
  const [selectedOccurrence, setSelectedOccurrence] =
    React.useState<CalendarOccurrence | null>(null);
  const [isLoadingCalendars, setIsLoadingCalendars] = React.useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(false);

  const selectedCalendar = React.useMemo(
    () => calendars.find((calendar) => calendar.id === selectedCalendarId) ?? null,
    [calendars, selectedCalendarId]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadCalendars() {
      setIsLoadingCalendars(true);
      try {
        const res = await fetch("/api/academic-calendars?all=1", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load academic calendars");
        }

        const rawCalendars: unknown[] = Array.isArray(json.data) ? json.data : [];
        const nextCalendars = rawCalendars
          .map(toCalendarSummary)
          .filter((calendar: CalendarSummary) => calendar.id);
        const defaultCalendar =
          nextCalendars.find((calendar) => calendar.isPublished) ?? nextCalendars[0] ?? null;

        if (!cancelled) {
          setCalendars(nextCalendars);
          setSelectedCalendarId((current) => current || defaultCalendar?.id || "");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load calendars");
        }
      } finally {
        if (!cancelled) setIsLoadingCalendars(false);
      }
    }

    loadCalendars();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedCalendarId) {
      setOccurrences([]);
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      setIsLoadingEvents(true);
      try {
        const params = new URLSearchParams({
          from: startOfMonth(month).toISOString(),
          to: endOfMonth(month).toISOString(),
        });
        const res = await fetch(
          `/api/academic-calendars/${selectedCalendarId}/events?${params}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load calendar events");
        }

        if (!cancelled) {
          setOccurrences(
            Array.isArray(json.data?.occurrences)
              ? (json.data.occurrences as CalendarOccurrence[])
              : []
          );
          setSelectedOccurrence(null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load events");
        }
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [month, selectedCalendarId]);

  return (
    <Card className="border border-(--ws-line) bg-gradient-to-br from-(--ws-panel-from) to-(--ws-panel-to) backdrop-blur-xl">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-300/20 bg-purple-400/10">
              <Calendar className="h-5 w-5 text-(--ws-violet)" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-(--ws-fg)">Academic Calendar</h3>
                {selectedCalendar?.isPublished && (
                  <Badge className="border-emerald-400/25 bg-emerald-500/15 text-(--ws-emerald)">
                    Published
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-(--ws-fg-70)">
                Review the real school calendar here: term milestones, holidays, exam weeks,
                non-teaching days, and events. Use the full calendar workspace when you need to add
                or edit entries.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild className="bg-purple-600 text-white hover:bg-purple-500">
              <Link href="/admin/academic-calendar">
                Manage calendar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
            >
              <Link href="/admin/periods">Academic periods</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PremiumSelect
              value={selectedCalendarId}
              onValueChange={(value) => setSelectedCalendarId(value)}
              disabled={isLoadingCalendars || calendars.length === 0}
            >
              <PremiumSelectTrigger className="w-full min-w-[240px] border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) sm:w-[300px]">
                <PremiumSelectValue placeholder="Select academic calendar" />
              </PremiumSelectTrigger>
              <PremiumSelectContent className="border-(--ws-line) bg-(--ws-popover) text-(--ws-fg)">
                {calendars.map((calendar) => (
                  <PremiumSelectItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            {isLoadingCalendars && (
              <span className="flex items-center gap-2 text-sm text-(--ws-fg-70)">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading calendars
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
              onClick={() => setMonth((current) => subMonths(current, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[150px] text-center text-sm font-semibold text-(--ws-fg)">
              {format(month, "MMMM yyyy")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {calendars.length === 0 && !isLoadingCalendars ? (
          <div className="rounded-xl border border-dashed border-(--ws-line) bg-(--ws-fill) p-6 text-center">
            <p className="text-sm font-medium text-(--ws-fg)">No academic calendar has been created.</p>
            <p className="mt-1 text-sm text-(--ws-fg-70)">
              Create the first calendar from the full calendar workspace, then it will appear here.
            </p>
            <Button asChild className="mt-4 bg-purple-600 text-white hover:bg-purple-500">
              <Link href="/admin/academic-calendar">Create calendar</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative min-w-0 overflow-x-auto">
              {isLoadingEvents && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-(--ws-popover)/55 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-(--ws-fg-70)" />
                </div>
              )}
              <div className="min-w-[760px]">
                <MonthGrid
                  month={month}
                  occurrences={occurrences}
                  onSelectOccurrence={setSelectedOccurrence}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <h4 className="text-sm font-semibold text-(--ws-fg)">Month agenda</h4>
                <p className="mt-1 text-xs text-(--ws-fg-70)">
                  {occurrences.length} event{occurrences.length === 1 ? "" : "s"} in{" "}
                  {format(month, "MMMM")}
                </p>
              </div>
              {selectedOccurrence && (
                <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--ws-violet)">
                    Selected event
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-(--ws-fg)">
                    {selectedOccurrence.title}
                  </h4>
                  <p className="mt-1 text-xs text-(--ws-fg-70)">
                    {format(new Date(selectedOccurrence.startDate), "MMM d, yyyy")}
                    {" - "}
                    {format(new Date(selectedOccurrence.endDate), "MMM d, yyyy")}
                  </p>
                </div>
              )}
              <div className="max-h-[540px] overflow-y-auto pr-1">
                <AgendaList
                  occurrences={occurrences}
                  onSelectOccurrence={setSelectedOccurrence}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
