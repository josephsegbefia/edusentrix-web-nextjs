"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, Clock3, MapPin, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { glassInsetClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { PublishedExamTimetableDTO } from "@/types/academics/exam-scheduling-engine";

function formatExamDate(value: string) {
  return format(new Date(value), "EEE, d MMM yyyy");
}

function formatVenueLabel(venueName: string | null, roomLabel: string | null) {
  if (venueName && roomLabel) return `${venueName} · ${roomLabel}`;
  return venueName || roomLabel || "Venue to be confirmed";
}

export function PublishedExamTimetableView({
  data,
  loading,
  errorMessage,
  onRefresh,
  isRefreshing,
  emptyTitle = "No upcoming exams published yet",
  emptyDescription = "When the school publishes an exam timetable for this class, it will appear here.",
}: {
  data?: PublishedExamTimetableDTO;
  loading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <GlassPanel key={index} className="p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/3 rounded bg-white/10" />
              <div className="h-3 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
            </div>
          </GlassPanel>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <GlassPanel className="p-6 text-center">
        <p className="text-base font-medium text-white">Could not load exam timetable</p>
        <p className="mt-2 text-sm text-white/60">{errorMessage}</p>
      </GlassPanel>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      {(data?.lastUpdatedAt || data?.latestVersionNumber || onRefresh) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-white/60">
            {data?.latestVersionNumber ? (
              <span>Timetable version {data.latestVersionNumber}</span>
            ) : null}
            {data?.lastUpdatedAt ? (
              <span>
                {data.latestVersionNumber ? " · " : ""}
                Last updated {format(new Date(data.lastUpdatedAt), "d MMM yyyy, HH:mm")}
              </span>
            ) : null}
          </div>
          {onRefresh ? (
            <Button
              variant="outline"
              size="sm"
              className={cn("rounded-xl", glassSecondaryButtonClass)}
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          ) : null}
        </div>
      )}

      {entries.length === 0 ? (
        <GlassPanel className="p-6 sm:p-8">
          <div className="mx-auto max-w-md space-y-3 text-center">
            <p className="text-base font-medium text-white">{emptyTitle}</p>
            <p className="text-sm text-white/60">{emptyDescription}</p>
          </div>
        </GlassPanel>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <GlassPanel key={entry.entryId} className="p-4 sm:p-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
                    {entry.examSessionName}
                  </Badge>
                  {entry.version ? (
                    <Badge className="border-white/15 bg-white/5 text-white/70">
                      v{entry.version.versionNumber}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {entry.title || entry.subjectName || "Exam"}
                  </h3>
                  {entry.classGroupNames.length ? (
                    <p className="mt-1 text-sm text-white/60">{entry.classGroupNames.join(", ")}</p>
                  ) : null}
                </div>
                <div className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{formatExamDate(entry.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span>
                      {entry.startTime} – {entry.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{formatVenueLabel(entry.venueName, entry.roomLabel)}</span>
                  </div>
                </div>
                {entry.instructionsForStudents ? (
                  <div className={cn(glassInsetClass, "p-3 text-sm text-white/70")}>
                    <p className="font-medium text-white/85">Instructions</p>
                    <p className="mt-1 whitespace-pre-wrap">{entry.instructionsForStudents}</p>
                  </div>
                ) : null}
                {entry.materialsAllowed.length ? (
                  <div className={cn(glassInsetClass, "p-3 text-sm text-white/70")}>
                    <p className="font-medium text-white/85">Materials allowed</p>
                    <p className="mt-1">{entry.materialsAllowed.join(", ")}</p>
                  </div>
                ) : null}
                {entry.version?.changeSummary ? (
                  <div className={cn(glassInsetClass, "p-3 text-sm text-white/60")}>
                    <p className="font-medium text-white/75">Latest timetable note</p>
                    <p className="mt-1">{entry.version.changeSummary}</p>
                  </div>
                ) : null}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
