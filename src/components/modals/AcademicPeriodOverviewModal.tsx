"use client";

import Link from "next/link";
import { format } from "date-fns/format";
import {
  Calendar,
  CalendarRange,
  ArrowUpRight,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AcademicPeriodOverviewData } from "@/hooks/admin/useAcademicPeriodOverview";
import type { PeriodStatusData } from "@/hooks/admin/usePeriodStatus";

type AcademicPeriodOverviewModalProps = {
  onClose: () => void;
  overview?: AcademicPeriodOverviewData;
  status?: PeriodStatusData;
  isLoading?: boolean;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  academic: "Academic",
  exam: "Exam",
  holiday: "Holiday",
  sports: "Sports",
  meeting: "Meeting",
  activity: "Activity",
  non_teaching_day: "Non-Teaching Day",
  custom: "Custom",
};

function formatDateLong(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "EEE, dd MMM yyyy");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "EEE, dd MMM • p");
}

function termProgress(start?: string | null, end?: string | null) {
  if (!start || !end) return { pct: 0, label: "Not Set" };
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return { pct: 0, label: "Starts soon" };
  if (now >= e) return { pct: 100, label: "Completed" };
  const pct = Math.round(((now - s) / (e - s)) * 100);
  return { pct, label: `${pct}% complete` };
}

function getStatusBadge(status?: PeriodStatusData["status"]) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "expiring_soon":
    case "expiring_very_soon":
      return {
        label: "Expiring Soon",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    case "expiring_critical":
    case "grace_period":
      return {
        label: "Attention Needed",
        className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
      };
    case "expired":
      return {
        label: "Expired",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    case "no_period":
      return {
        label: "No Period",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    default:
      return {
        label: "Status Unknown",
        className: "border-white/20 bg-white/5 text-white/70",
      };
  }
}

export function AcademicPeriodOverviewModal({
  onClose,
  overview,
  status,
  isLoading = false,
}: AcademicPeriodOverviewModalProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Loading period overview...
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Could not load academic period overview.
        </div>
      </div>
    );
  }

  const current = overview.currentPeriod;
  const previous = overview.previousPeriod;
  const progress = termProgress(current?.startDate, current?.endDate);
  const badge = getStatusBadge(status?.status);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="text-xs text-white/50">
            {status?.message || "Academic period status overview"}
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-white/50">Current Period</p>
            <p className="text-base font-semibold text-white">
              {current ? `${current.term} ${current.yearLabel}` : "Not configured"}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {formatDateLong(current?.startDate)} to {formatDateLong(current?.endDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Progress</p>
            <p className="text-sm font-semibold text-white">{progress.label}</p>
            {status?.daysUntilExpiry !== null && status?.daysUntilExpiry !== undefined ? (
              <p className="text-xs text-amber-300">
                {status.daysUntilExpiry} day{status.daysUntilExpiry === 1 ? "" : "s"} left
              </p>
            ) : null}
          </div>
        </div>
        {current ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-300 transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Upcoming ({overview.upcoming.days}d)</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {overview.upcoming.totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Next 7 Days</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {overview.upcoming.next7DaysCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Calendars</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {overview.meta.calendarsCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Events Configured</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {overview.meta.eventsConfigured}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Upcoming Events</h4>
          <Link
            href="/admin/academic-calendar"
            className="inline-flex items-center gap-1 text-xs text-brand hover:opacity-90"
          >
            Open calendar
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {overview.upcoming.preview.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs text-white/60">
            No upcoming events in the next {overview.upcoming.days} days.
          </div>
        ) : (
          <div className="space-y-2">
            {overview.upcoming.preview.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/10 p-3"
              >
                <div className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/15 p-2">
                  <Calendar className="h-3.5 w-3.5 text-fuchsia-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{event.title}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60">
                      {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                    </span>
                    {event.isRecurring ? (
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        Recurring
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-white/55">
                    {formatDateTime(event.startDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-white/60" />
          <h4 className="text-sm font-semibold text-white">Immediate Past Period</h4>
        </div>
        {previous ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-sm font-medium text-white">
              {previous.term} {previous.yearLabel}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {formatDateLong(previous.startDate)} to {formatDateLong(previous.endDate)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/60">No previous period found.</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Close
        </Button>
        <Link href="/admin/academic-calendar">
          <Button
            type="button"
            className="w-full gap-2 bg-brand text-black hover:bg-brand/90 sm:w-auto"
          >
            <CalendarRange className="h-4 w-4" />
            Open Academic Calendar
          </Button>
        </Link>
      </div>
    </div>
  );
}
