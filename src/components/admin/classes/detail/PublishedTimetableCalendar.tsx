"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Coffee,
  LandPlot,
  LayoutGrid,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import type { EventContentArg } from "@fullcalendar/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimeLabel } from "@/components/admin/timetable/types";
import type {
  PublishedClassSlotDTO,
  PublishedGapFillDTO,
} from "@/hooks/admin/useClassPublishedTimetable";
import type { PublishedDayScheduleSegmentDTO } from "@/lib/timetable/publishedTimetableDaySegments";
import {
  buildPublishedTimetableEvents,
  weekSundayContaining,
} from "@/lib/timetable/publishedTimetableEvents";
import { cn } from "@/lib/utils";
import "./published-timetable-fullcalendar.css";

const FullCalendar = dynamic(
  () => import("@fullcalendar/react").then((m) => m.default),
  { ssr: false, loading: () => <PublishedCalendarSkeleton /> }
);

function PublishedCalendarSkeleton() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-white/2 text-sm text-white/50">
      Loading week view…
    </div>
  );
}

type PublishedTimetableCalendarProps = {
  classLabel: string;
  workingDays: number[];
  timeAxis: { startHour: number; endHour: number; hours: number[] };
  slots: PublishedClassSlotDTO[];
  gapFills: PublishedGapFillDTO[];
  dayScheduleSegments: PublishedDayScheduleSegmentDTO[];
  calendarKey?: string;
  /** Number of slots whose teacher comes from the timetable snapshot only (no active assignment). */
  staleTeacherSlotCount?: number;
};

type EventKind =
  | "lesson"
  | "gap"
  | "scheduleBreak"
  | "scheduleAssembly"
  | "scheduleOpening"
  | "dayClose";

type PublishedEventTone = {
  bodyClassName: string;
  eyebrowClassName: string;
  metaClassName: string;
};

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = (Number.isFinite(startHour) ? startHour : 0) * 60 +
    (Number.isFinite(startMinute) ? startMinute : 0);
  const endTotal = (Number.isFinite(endHour) ? endHour : 0) * 60 +
    (Number.isFinite(endMinute) ? endMinute : 0);
  return Math.max(0, endTotal - startTotal);
}

function timeRangeText(start: string, end: string) {
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
}

function PublishedEventCard({
  icon: Icon,
  eyebrow,
  title,
  timeText,
  detail,
  description,
  durationMinutes,
  isCurrent,
  tone,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  timeText: string;
  detail?: string | null;
  description?: string | null;
  durationMinutes: number;
  isCurrent?: boolean;
  tone: PublishedEventTone;
}) {
  const isUltraCompact = durationMinutes > 0 && durationMinutes <= 20;
  const isCompact = durationMinutes > 20 && durationMinutes < 45;

  if (isUltraCompact) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-xl border px-2 py-1.5 text-left",
          tone.bodyClassName,
          isCurrent &&
            "border-sky-300/70 bg-sky-500/20 ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_0_20px_rgba(14,165,233,0.22)]"
        )}
      >
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            tone.eyebrowClassName,
            isCurrent && "text-sky-100"
          )}
        />
        {isCurrent ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-200 shadow-[0_0_10px_rgba(125,211,252,0.9)]" />
        ) : null}
        <p className="truncate text-[11px] font-semibold text-white">{title}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border px-2.5 py-2 text-left",
        tone.bodyClassName,
        isCompact && "gap-0.5 px-2 py-1.5",
        isCurrent &&
          "border-sky-300/70 bg-sky-500/15 ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_0_24px_rgba(14,165,233,0.24)]"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
          tone.eyebrowClassName
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{eyebrow}</span>
        {isCurrent ? (
          <span className="ml-auto shrink-0 rounded-full bg-sky-200/18 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-sky-100">
            NOW
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 min-w-0 break-words font-semibold text-white",
          isCompact ? "line-clamp-1 text-xs leading-snug" : "line-clamp-2 text-sm leading-tight"
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-[10px] tracking-tight",
          tone.metaClassName,
          isCompact && "mt-0.5"
        )}
      >
        {timeText}
      </p>
      {!isCompact && detail ? (
        <p className={cn("min-w-0 truncate text-[11px] leading-snug", tone.metaClassName)}>
          {detail}
        </p>
      ) : null}
      {!isCompact && description ? (
        <p
          className={cn(
            "min-w-0 break-words text-[11px] leading-relaxed",
            tone.metaClassName,
            "line-clamp-2"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function renderEventContent(arg: EventContentArg) {
  const kind = arg.event.extendedProps?.kind as EventKind | undefined;
  const isCurrent = arg.event.extendedProps?.isCurrent === true;
  if (kind === "lesson") {
    const slot = arg.event.extendedProps?.slot as PublishedClassSlotDTO | undefined;
    if (!slot) {
      return <div className="p-1 text-xs text-white/80">{arg.event.title}</div>;
    }
    const durationMinutes = minutesBetween(slot.startTime, slot.endTime);
    const isSlotSource = slot.teacherLinkSource === "slot";
    const teacherDetail =
      slot.teacherName && slot.teacherName !== "Unassigned"
        ? isSlotSource
          ? `${slot.teacherName} (no current assignment)`
          : slot.teacherName
        : "Teacher not assigned";
    return (
      <PublishedEventCard
        icon={BookOpen}
        eyebrow={isSlotSource ? "Lesson · assignment mismatch" : "Lesson"}
        title={
          slot.subjectCode ? `${slot.subjectName} · ${slot.subjectCode}` : slot.subjectName
        }
        timeText={timeRangeText(slot.startTime, slot.endTime)}
        detail={teacherDetail}
        description={slot.classroomLabel ? `Room ${slot.classroomLabel}` : null}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={
          isSlotSource
            ? {
                bodyClassName:
                  "border-amber-400/35 bg-linear-to-br from-amber-500/15 via-amber-900/10 to-slate-950/80 shadow-[0_1px_0_0_rgba(251,191,36,0.12)_inset]",
                eyebrowClassName: "text-amber-200/90",
                metaClassName: "text-amber-100/75",
              }
            : {
                bodyClassName:
                  "border-cyan-400/30 bg-linear-to-br from-cyan-500/20 via-sky-500/10 to-slate-950/80 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
                eyebrowClassName: "text-cyan-100/85",
                metaClassName: "text-white/65",
              }
        }
      />
    );
  }
  if (kind === "gap") {
    const fill = arg.event.extendedProps?.fill as PublishedGapFillDTO | undefined;
    if (!fill) {
      return <div className="p-1 text-xs text-amber-100/80">{arg.event.title}</div>;
    }
    const durationMinutes = minutesBetween(fill.startTime, fill.endTime);
    return (
      <PublishedEventCard
        icon={Sparkles}
        eyebrow="Unallocated time"
        title={fill.label}
        timeText={timeRangeText(fill.startTime, fill.endTime)}
        description={fill.description}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={{
          bodyClassName:
            "border-amber-400/30 bg-linear-to-br from-amber-500/20 to-amber-950/30 shadow-[0_1px_0_0_rgba(251,191,36,0.15)_inset]",
          eyebrowClassName: "text-amber-200/90",
          metaClassName: "text-amber-100/75",
        }}
      />
    );
  }

  const seg = arg.event.extendedProps?.segment as PublishedDayScheduleSegmentDTO | undefined;
  if (kind === "scheduleBreak" && seg) {
    const durationMinutes = minutesBetween(seg.startTime, seg.endTime);
    return (
      <PublishedEventCard
        icon={Coffee}
        eyebrow="Break"
        title={seg.label}
        timeText={timeRangeText(seg.startTime, seg.endTime)}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={{
          bodyClassName:
            "border-emerald-400/30 bg-linear-to-br from-emerald-500/20 to-slate-950/80",
          eyebrowClassName: "text-emerald-200/90",
          metaClassName: "text-emerald-100/75",
        }}
      />
    );
  }
  if (kind === "scheduleAssembly" && seg) {
    const durationMinutes = minutesBetween(seg.startTime, seg.endTime);
    return (
      <PublishedEventCard
        icon={Users}
        eyebrow="Assembly"
        title={seg.label}
        timeText={timeRangeText(seg.startTime, seg.endTime)}
        description={seg.detail}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={{
          bodyClassName:
            "border-rose-400/30 bg-linear-to-br from-rose-500/20 to-slate-950/80",
          eyebrowClassName: "text-rose-200/90",
          metaClassName: "text-rose-100/70",
        }}
      />
    );
  }
  if (kind === "scheduleOpening" && seg) {
    const durationMinutes = minutesBetween(seg.startTime, seg.endTime);
    return (
      <PublishedEventCard
        icon={LandPlot}
        eyebrow="Opening"
        title={seg.label}
        timeText={timeRangeText(seg.startTime, seg.endTime)}
        description={seg.detail}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={{
          bodyClassName:
            "border-violet-400/30 bg-linear-to-br from-violet-500/20 to-slate-950/80",
          eyebrowClassName: "text-violet-200/90",
          metaClassName: "text-violet-100/70",
        }}
      />
    );
  }
  if (kind === "dayClose" && seg) {
    const durationMinutes = minutesBetween(seg.startTime, seg.endTime);
    return (
      <PublishedEventCard
        icon={Clock}
        eyebrow="End of day"
        title={seg.label}
        timeText={timeRangeText(seg.startTime, seg.endTime)}
        description={seg.detail}
        durationMinutes={durationMinutes}
        isCurrent={isCurrent}
        tone={{
          bodyClassName:
            "border border-dashed border-slate-400/35 bg-slate-900/60",
          eyebrowClassName: "text-slate-200/90",
          metaClassName: "text-slate-200/75",
        }}
      />
    );
  }
  return <div className="p-1 text-xs text-white/70">{arg.event.title}</div>;
}

/**
 * Read-only week schedule with FullCalendar time grid, Edusentrix theming, lessons, unallocated
 * labels, and school-day breaks / assembly / closing.
 */
export function PublishedTimetableCalendar({
  classLabel,
  workingDays,
  timeAxis,
  slots,
  gapFills,
  dayScheduleSegments,
  calendarKey = "cal",
  staleTeacherSlotCount = 0,
}: PublishedTimetableCalendarProps) {
  const { startHour, endHour } = timeAxis;
  const [now, setNow] = React.useState(() => new Date());

  const weekSunday = React.useMemo(() => weekSundayContaining(new Date()), []);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const events = React.useMemo(
    () => buildPublishedTimetableEvents(weekSunday, slots, gapFills, dayScheduleSegments, now),
    [weekSunday, slots, gapFills, dayScheduleSegments, now]
  );

  const hiddenDays = React.useMemo(() => {
    const set = new Set(workingDays);
    return [0, 1, 2, 3, 4, 5, 6].filter((d) => !set.has(d));
  }, [workingDays]);

  const slotMin = `${String(Math.max(0, Math.min(23, startHour))).padStart(2, "0")}:00:00`;
  const slotMax = `${String(Math.max(0, Math.min(24, endHour))).padStart(2, "0")}:00:00`;

  const scroll = React.useMemo(() => {
    const s = timeAxis.hours[0] ?? startHour;
    return `${String(s).padStart(2, "0")}:00:00`;
  }, [timeAxis.hours, startHour]);

  return (
    <Card className="overflow-hidden border-white/10 bg-linear-to-b from-white/5 to-transparent shadow-xl shadow-black/20">
      <CardHeader className="space-y-3 border-b border-white/[0.07] pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <LayoutGrid className="h-5 w-5 text-cyan-300" />
              Published week · {classLabel}
            </CardTitle>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-white/55">
              A cleaner week view for this class: lessons, breaks, assembly blocks, and free
              periods, all aligned to the configured school day.
            </p>
          </div>
        </div>
        {staleTeacherSlotCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              <span className="font-semibold">{staleTeacherSlotCount} slot{staleTeacherSlotCount === 1 ? "" : "s"} have a mismatched teacher.</span>{" "}
              The teacher shown comes from the timetable snapshot but has no current subject assignment in this class.
              Go to the <span className="font-medium">Subjects</span> tab to assign the correct teacher, then re-publish the timetable.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100/90"
            title="Timetabled subjects for this class"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]" />
            Lessons
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100/90"
            title="Time not covered by a subject; label is set per grade"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#fbbf24]" />
            Unallocated time
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100/90"
            title="Breaks from your school day configuration"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_#6ee7b7]" />
            Breaks
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-100/90"
            title="Assembly and similar blocks"
          >
            <Sun className="h-3 w-3" />
            Assembly / openings
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/25 bg-slate-500/10 px-2.5 py-1 text-[11px] font-medium text-slate-200/90"
            title="Last bell / official end of the school day"
          >
            <Clock className="h-3 w-3" />
            Closing
          </span>
          {staleTeacherSlotCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200/90"
              title="Teacher appears in the timetable but has no active subject assignment in this class"
            >
              <AlertTriangle className="h-3 w-3" />
              Assignment mismatch
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <div className="published-timetable-fc p-1 sm:p-3">
          <FullCalendar
            key={calendarKey}
            plugins={[timeGridPlugin]}
            initialView="timeGridWeek"
            initialDate={weekSunday}
            firstDay={0}
            hiddenDays={hiddenDays}
            weekends
            events={events}
            headerToolbar={false}
            allDaySlot={false}
            nowIndicator
            slotMinTime={slotMin}
            slotMaxTime={slotMax}
            slotDuration="00:15:00"
            slotLabelInterval={{ hours: 1 }}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            dayHeaderFormat={{ weekday: "short" }}
            scrollTime={scroll}
            contentHeight={640}
            eventContent={renderEventContent as never}
            eventMinHeight={24}
            handleWindowResize
          />
        </div>
      </CardContent>
    </Card>
  );
}
