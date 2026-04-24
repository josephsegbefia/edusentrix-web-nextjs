"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Layers3,
  MapPin,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type TeacherWeekAgendaDTO,
  type TeacherWeekDutyDTO,
  type TeacherWeekLessonDTO,
} from "@/hooks/admin/useTeacherWeekAgenda";
import { cn } from "@/lib/utils";
import "./../../classes/detail/published-timetable-fullcalendar.css";

const FullCalendar = dynamic(
  () => import("@fullcalendar/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/55">
        Loading weekly schedule…
      </div>
    ),
  }
);

type TeacherWeekScheduleCalendarProps = {
  teacherName: string;
  agenda: TeacherWeekAgendaDTO;
  isFetching?: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
};

type EventKind = "lesson" | "duty";

function parseYmdLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function mondayContaining(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function formatYmd(date: Date): string {
  const year = date.getFullYear().toString();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function atDateTime(dateYmd: string, hhmm: string): Date {
  const base = parseYmdLocal(dateYmd);
  const [hours, minutes] = hhmm.split(":").map(Number);
  base.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return base;
}

function formatClock(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const period = safeHours >= 12 ? "PM" : "AM";
  const hour12 = safeHours % 12 || 12;
  return `${hour12}:${String(safeMinutes).padStart(2, "0")} ${period}`;
}

function timeRangeText(startTime: string, endTime: string): string {
  return `${formatClock(startTime)} – ${formatClock(endTime)}`;
}

function minutesBetween(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const startTotal =
    (Number.isFinite(startHour) ? startHour : 0) * 60 +
    (Number.isFinite(startMinute) ? startMinute : 0);
  const endTotal =
    (Number.isFinite(endHour) ? endHour : 0) * 60 +
    (Number.isFinite(endMinute) ? endMinute : 0);
  return Math.max(0, endTotal - startTotal);
}

function weekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = parseYmdLocal(weekStart);
  const end = parseYmdLocal(weekEnd);
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

function hexToRgba(hex: string | null | undefined, alpha: number): string {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `rgba(245, 158, 11, ${alpha})`;
  }
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildTeacherWeekEvents(
  lessons: TeacherWeekLessonDTO[],
  duties: TeacherWeekDutyDTO[],
  now: Date
): EventInput[] {
  const nowMs = now.getTime();
  const events: EventInput[] = [];

  for (const lesson of lessons) {
    const start = atDateTime(lesson.date, lesson.startTime);
    const end = atDateTime(lesson.date, lesson.endTime);
    if (end <= start) continue;
    events.push({
      id: `lesson-${lesson.id}-${lesson.date}`,
      title: lesson.subjectName,
      start,
      end,
      display: "block",
      backgroundColor: "transparent",
      borderColor: "transparent",
      classNames: ["edus-pub-event", "edus-pub-event--lesson"],
      extendedProps: {
        kind: "lesson" as const,
        lesson,
        isCurrent: start.getTime() <= nowMs && nowMs < end.getTime(),
      },
    });
  }

  for (const duty of duties) {
    const start = atDateTime(duty.date, duty.startTime);
    const end = atDateTime(duty.date, duty.endTime);
    if (end <= start) continue;
    events.push({
      id: `duty-${duty.id}-${duty.date}`,
      title: duty.dutyName,
      start,
      end,
      display: "block",
      backgroundColor: "transparent",
      borderColor: "transparent",
      classNames: ["edus-pub-event", "edus-pub-event--duty"],
      extendedProps: {
        kind: "duty" as const,
        duty,
        isCurrent: start.getTime() <= nowMs && nowMs < end.getTime(),
      },
    });
  }

  return events;
}

function EventCard({
  icon: Icon,
  eyebrow,
  title,
  timeText,
  detail,
  description,
  durationMinutes,
  isCurrent,
  bodyClassName,
  eyebrowClassName,
  metaClassName,
  style,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  timeText: string;
  detail?: string | null;
  description?: string | null;
  durationMinutes: number;
  isCurrent?: boolean;
  bodyClassName: string;
  eyebrowClassName: string;
  metaClassName: string;
  style?: React.CSSProperties;
}) {
  const isUltraCompact = durationMinutes > 0 && durationMinutes <= 20;
  const isCompact = durationMinutes > 20 && durationMinutes < 45;

  if (isUltraCompact) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-xl border px-2 py-1.5 text-left",
          bodyClassName,
          isCurrent &&
            "border-sky-300/70 bg-sky-500/20 ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_0_20px_rgba(14,165,233,0.22)]"
        )}
        style={style}
      >
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            eyebrowClassName,
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
        bodyClassName,
        isCompact && "gap-0.5 px-2 py-1.5",
        isCurrent &&
          "border-sky-300/70 bg-sky-500/15 ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_0_24px_rgba(14,165,233,0.24)]"
      )}
      style={style}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
          eyebrowClassName
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
          metaClassName,
          isCompact && "mt-0.5"
        )}
      >
        {timeText}
      </p>
      {!isCompact && detail ? (
        <p className={cn("min-w-0 truncate text-[11px] leading-snug", metaClassName)}>
          {detail}
        </p>
      ) : null}
      {!isCompact && description ? (
        <p
          className={cn(
            "min-w-0 break-words text-[11px] leading-relaxed line-clamp-2",
            metaClassName
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
    const lesson = arg.event.extendedProps?.lesson as TeacherWeekLessonDTO | undefined;
    if (!lesson) {
      return <div className="p-1 text-xs text-white/80">{arg.event.title}</div>;
    }
    const otherTeachers = lesson.teacherNames.filter(
      (name) => name && name !== lesson.teacherName
    );
    const descriptionParts = [];
    if (lesson.classroomLabel) {
      descriptionParts.push(`Room ${lesson.classroomLabel}`);
    }
    if (otherTeachers.length > 0) {
      descriptionParts.push(`With ${otherTeachers.join(", ")}`);
    }
    return (
      <EventCard
        icon={BookOpen}
        eyebrow="Lesson"
        title={
          lesson.subjectCode
            ? `${lesson.subjectName} · ${lesson.subjectCode}`
            : lesson.subjectName
        }
        timeText={timeRangeText(lesson.startTime, lesson.endTime)}
        detail={lesson.classLabel}
        description={descriptionParts.join(" • ") || null}
        durationMinutes={minutesBetween(lesson.startTime, lesson.endTime)}
        isCurrent={isCurrent}
        bodyClassName="border-cyan-400/30 bg-linear-to-br from-cyan-500/20 via-sky-500/10 to-slate-950/80 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
        eyebrowClassName="text-cyan-100/85"
        metaClassName="text-white/65"
      />
    );
  }

  if (kind === "duty") {
    const duty = arg.event.extendedProps?.duty as TeacherWeekDutyDTO | undefined;
    if (!duty) {
      return <div className="p-1 text-xs text-white/80">{arg.event.title}</div>;
    }
    const detail = [duty.location, duty.dutyCategory]
      .filter((value): value is string => Boolean(value))
      .join(" • ");
    const style = {
      borderColor: hexToRgba(duty.dutyColor, 0.55),
      background: `linear-gradient(180deg, ${hexToRgba(duty.dutyColor, 0.24)} 0%, rgba(15, 23, 42, 0.86) 100%)`,
      boxShadow: `0 1px 0 0 ${hexToRgba(duty.dutyColor, 0.12)} inset`,
    } satisfies React.CSSProperties;

    return (
      <EventCard
        icon={ClipboardList}
        eyebrow="Duty"
        title={duty.dutyName}
        timeText={timeRangeText(duty.startTime, duty.endTime)}
        detail={detail || null}
        description={duty.notes || null}
        durationMinutes={minutesBetween(duty.startTime, duty.endTime)}
        isCurrent={isCurrent}
        bodyClassName="bg-slate-950/80"
        eyebrowClassName="text-amber-100/90"
        metaClassName="text-white/70"
        style={style}
      />
    );
  }

  return <div className="p-1 text-xs text-white/70">{arg.event.title}</div>;
}

function TodayBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100/90">
      <Sparkles className="h-3 w-3" />
      Current week
    </span>
  );
}

export function TeacherWeekScheduleCalendar({
  teacherName,
  agenda,
  isFetching = false,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: TeacherWeekScheduleCalendarProps) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const events = React.useMemo(
    () => buildTeacherWeekEvents(agenda.lessons, agenda.duties, now),
    [agenda.duties, agenda.lessons, now]
  );

  const hiddenDays = React.useMemo(() => {
    const visible = new Set(agenda.visibleDays);
    return [0, 1, 2, 3, 4, 5, 6].filter((day) => !visible.has(day));
  }, [agenda.visibleDays]);

  const slotMinTime = `${String(
    Math.max(0, Math.min(23, agenda.timeAxis.startHour))
  ).padStart(2, "0")}:00:00`;
  const slotMaxTime = `${String(
    Math.max(0, Math.min(24, agenda.timeAxis.endHour))
  ).padStart(2, "0")}:00:00`;
  const scrollTime = `${String(
    agenda.timeAxis.hours[0] ?? agenda.timeAxis.startHour
  ).padStart(2, "0")}:00:00`;

  const weekLabel = weekRangeLabel(agenda.weekStart, agenda.weekEnd);
  const hasDraft = agenda.academicPeriods.some(
    (period) => period.lessonVersionStatus === "draft"
  );
  const hasLessons = agenda.summary.lessonCount > 0;
  const hasDuties = agenda.summary.dutyCount > 0;
  const isCurrentWeek = agenda.weekStart === formatYmd(mondayContaining(new Date()));

  return (
    <Card className="overflow-hidden border-white/10 bg-linear-to-b from-white/5 to-transparent shadow-xl shadow-black/20">
      <CardHeader className="space-y-4 border-b border-white/[0.07] pb-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              Weekly schedule · {teacherName}
            </CardTitle>
            <p className="max-w-3xl text-sm leading-relaxed text-white/55">
              Lessons repeat each week from the active class timetables in the
              current academic period. Non-teaching duties appear only on dates
              where they are active inside that period.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPreviousWeek}
              className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCurrentWeek}
              className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              This week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNextWeek}
              className="gap-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            >
              Next week
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/85">
            <Clock className="h-3 w-3 text-cyan-300" />
            {weekLabel}
          </span>
          {isCurrentWeek ? <TodayBadge /> : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100/90">
            <BookOpen className="h-3 w-3" />
            {agenda.summary.lessonCount} lessons
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100/90">
            <ClipboardList className="h-3 w-3" />
            {agenda.summary.dutyCount} duties
          </span>
          {hasDraft ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-100/90">
              <Layers3 className="h-3 w-3" />
              Using draft timetable data where available
            </span>
          ) : null}
          {isFetching ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70">
              <RefreshCcw className="h-3 w-3 animate-spin" />
              Refreshing
            </span>
          ) : null}
        </div>

        {agenda.academicPeriods.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {agenda.academicPeriods.map((period) => (
              <span
                key={period.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80"
                title={`${format(parseYmdLocal(period.startDate.slice(0, 10)), "MMM d, yyyy")} to ${format(parseYmdLocal(period.endDate.slice(0, 10)), "MMM d, yyyy")}`}
              >
                <BriefcaseBusiness className="h-3 w-3 text-emerald-300" />
                {period.label}
                {period.lessonVersionStatus ? ` · ${period.lessonVersionStatus}` : " · no timetable"}
              </span>
            ))}
          </div>
        ) : null}

        {agenda.boundaryState !== "inside" ? (
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
              agenda.boundaryState === "outside"
                ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                : "border-amber-500/20 bg-amber-500/10 text-amber-100"
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">
                {agenda.boundaryState === "outside"
                  ? "This week sits outside the academic period range."
                  : "This week crosses an academic period boundary."}
              </p>
              <p className="text-xs leading-relaxed opacity-80">
                {agenda.boundaryState === "outside"
                  ? "Lessons repeat only inside academic periods, so this week will stay empty until you move to a valid week. Date-bound duties also remain hidden outside the period."
                  : "Only the dates that fall inside an academic period will show repeated lessons and active duties. Days outside the period remain empty by design."}
              </p>
            </div>
          </div>
        ) : null}

        {!hasLessons && !hasDuties ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
            No lessons or duties fall in this week for {teacherName}. If the
            teacher has subject assignments, check that the class-group
            timetable for the relevant academic period has been created.
          </div>
        ) : null}

        {!hasLessons && hasDuties ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
            Duties are active for this week, but no timetable lessons were found
            in the current academic period.
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        <div className="published-timetable-fc p-1 sm:p-3">
          <FullCalendar
            key={agenda.weekStart}
            plugins={[timeGridPlugin]}
            initialView="timeGridWeek"
            initialDate={parseYmdLocal(agenda.weekStart)}
            firstDay={1}
            hiddenDays={hiddenDays}
            weekends
            events={events}
            headerToolbar={false}
            allDaySlot={false}
            nowIndicator
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            slotDuration="00:15:00"
            slotLabelInterval={{ hours: 1 }}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
            scrollTime={scrollTime}
            contentHeight={640}
            eventContent={renderEventContent as never}
            eventMinHeight={24}
            handleWindowResize
          />
        </div>

        <div className="grid gap-px border-t border-white/10 bg-white/5 px-4 py-3 text-xs text-white/55 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-cyan-300" />
            Lessons repeat weekly inside the academic period.
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-amber-300" />
            Duties appear only on active dates and active date ranges.
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            The blue line and glow show the current time and current block.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
