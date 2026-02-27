"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import { isTimetableRoleReadViewsEnabled } from "@/lib/timetable/feature-flags";

type TimetableSlotView = {
  id: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  classGroupName?: string | null;
  gradeName?: string | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  teacherName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
};

type WeeklyTimetableResponse = {
  success: boolean;
  data: {
    scope: string;
    weekStart: string;
    weekEnd: string;
    workingDays: number[];
    days: Array<{
      date: string;
      dayOfWeek: number;
      slots: TimetableSlotView[];
    }>;
  };
  meta?: {
    publishedVersionId: string | null;
    publishedAt: string | null;
    noPublishedVersion?: boolean;
  };
  error?: string;
};

type ViewMode = "week" | "day";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type RoleWeekDayTimetableProps = {
  endpoint: string;
  title: string;
  subtitle?: string;
  noPublishedMessage?: string;
  emptyWeekMessage?: string;
  emptyDayMessage?: string;
  hideClassName?: boolean;
  hideTeacherName?: boolean;
  headerExtras?: React.ReactNode;
};

function toYmd(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromYmd(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDateShort(value: string): string {
  return fromYmd(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(startYmd: string, endYmd: string): string {
  const start = fromYmd(startYmd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const end = fromYmd(endYmd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} - ${end}`;
}

function formatTime(time: string): string {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function sortSlots(slots: TimetableSlotView[]): TimetableSlotView[] {
  return [...slots].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    if ((a.subjectName || "") !== (b.subjectName || "")) {
      return (a.subjectName || "").localeCompare(b.subjectName || "");
    }
    return a.id.localeCompare(b.id);
  });
}

function SlotRow({
  slot,
  hideClassName = false,
  hideTeacherName = false,
}: {
  slot: TimetableSlotView;
  hideClassName?: boolean;
  hideTeacherName?: boolean;
}) {
  const subjectLabel = slot.subjectName || "Subject";
  const teacherLabel = slot.teacherName || "Teacher";
  const classLabel = slot.classGroupName || slot.gradeName || "Class";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{subjectLabel}</p>
            {slot.subjectCode ? (
              <Badge variant="outline" className="border-white/20 text-xs text-white/70">
                {slot.subjectCode}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-white/65">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {slot.classroomLabel}
            </span>
            {!hideClassName ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {classLabel}
              </span>
            ) : null}
            {!hideTeacherName ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {teacherLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoleWeekDayTimetable({
  endpoint,
  title,
  subtitle,
  noPublishedMessage = "No published timetable is available yet.",
  emptyWeekMessage = "No timetable slots found for this week.",
  emptyDayMessage = "No timetable slots found for this day.",
  hideClassName = false,
  hideTeacherName = false,
  headerExtras,
}: RoleWeekDayTimetableProps) {
  const roleViewsEnabled = isTimetableRoleReadViewsEnabled();
  const [mode, setMode] = React.useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = React.useState<Date>(new Date());
  const [selectedDayOfWeek, setSelectedDayOfWeek] = React.useState<number>(new Date().getDay());

  const dateYmd = React.useMemo(() => toYmd(anchorDate), [anchorDate]);

  const query = useQuery<WeeklyTimetableResponse>({
    queryKey: ["role-week-day-timetable", endpoint, dateYmd],
    queryFn: async () => {
      const params = new URLSearchParams({ date: dateYmd });
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as WeeklyTimetableResponse | null;

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch timetable.");
      }

      return json;
    },
    staleTime: 30_000,
    enabled: roleViewsEnabled,
  });

  const weekData = query.data?.data;
  const weekDays = weekData?.days || [];
  const workingDays = weekData?.workingDays?.length ? weekData.workingDays : [1, 2, 3, 4, 5];

  React.useEffect(() => {
    if (mode === "day") {
      setSelectedDayOfWeek(anchorDate.getDay());
    }
  }, [anchorDate, mode]);

  const dayMap = React.useMemo(() => {
    const map = new Map<number, { date: string; dayOfWeek: number; slots: TimetableSlotView[] }>();
    for (const day of weekDays) {
      map.set(day.dayOfWeek, {
        ...day,
        slots: sortSlots(day.slots || []),
      });
    }
    return map;
  }, [weekDays]);

  const selectedDay = dayMap.get(selectedDayOfWeek) || null;

  const totalSlotsInWeek = React.useMemo(
    () => weekDays.reduce((sum, day) => sum + (day.slots?.length || 0), 0),
    [weekDays]
  );

  const isNoPublishedVersion = Boolean(query.data?.meta?.noPublishedVersion);

  const rangeLabel =
    mode === "day"
      ? selectedDay?.date
        ? formatDateShort(selectedDay.date)
        : fromYmd(dateYmd).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
      : weekData?.weekStart && weekData.weekEnd
      ? formatDateRange(weekData.weekStart, weekData.weekEnd)
      : "";

  const shiftBy = mode === "week" ? 7 : 1;

  const handlePrev = () => {
    setAnchorDate((prev) => addDays(prev, -shiftBy));
  };

  const handleNext = () => {
    setAnchorDate((prev) => addDays(prev, shiftBy));
  };

  const handleToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDayOfWeek(today.getDay());
  };

  if (!roleViewsEnabled) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-10 text-center">
          <p className="font-medium text-white">Timetable Views Disabled</p>
          <p className="mt-1 text-sm text-white/60">
            Role-based timetable views are currently disabled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              {title}
            </CardTitle>
            {subtitle ? <p className="mt-1 text-sm text-white/60">{subtitle}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {query.data?.meta?.publishedAt ? (
              <Badge variant="outline" className="border-emerald-400/30 text-emerald-200">
                Published {new Date(query.data.meta.publishedAt).toLocaleDateString()}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-400/30 text-amber-200">
                Unpublished
              </Badge>
            )}
            {mode === "week" ? (
              <Badge variant="outline" className="border-white/20 text-white/70">
                {totalSlotsInWeek} week slot{totalSlotsInWeek === 1 ? "" : "s"}
              </Badge>
            ) : selectedDay ? (
              <Badge variant="outline" className="border-white/20 text-white/70">
                {selectedDay.slots.length} day slot{selectedDay.slots.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>

        {headerExtras ? <div>{headerExtras}</div> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as ViewMode)}>
            <TabsList className="h-9 bg-black/30">
              <TabsTrigger value="week" className="text-xs data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                Week
              </TabsTrigger>
              <TabsTrigger value="day" className="text-xs data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                Day
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="border-white/20 bg-transparent text-white/75 hover:bg-white/10"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Prev
            </Button>
            <Badge variant="outline" className="border-white/20 text-white/75">
              {rangeLabel || "--"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="border-white/20 bg-transparent text-white/75 hover:bg-white/10"
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="border-white/20 bg-transparent text-white/75 hover:bg-white/10"
            >
              Today
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {workingDays.map((day) => {
            const dayPayload = dayMap.get(day);
            const active = day === selectedDayOfWeek;
            return (
              <Button
                key={day}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedDayOfWeek(day);
                  if (dayPayload?.date) {
                    setAnchorDate(fromYmd(dayPayload.date));
                  }
                }}
                className={cn(
                  active
                    ? "bg-cyan-500 text-white hover:bg-cyan-400"
                    : "border-white/20 bg-transparent text-white/75 hover:bg-white/10"
                )}
              >
                {DAY_SHORT[day]} {(dayPayload?.slots.length || 0) > 0 ? `(${dayPayload?.slots.length || 0})` : ""}
              </Button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading timetable...
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {query.error instanceof Error ? query.error.message : "Failed to load timetable."}
          </div>
        ) : isNoPublishedVersion ? (
          <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-6 text-center">
            <p className="text-sm font-medium text-amber-200">{noPublishedMessage}</p>
            <p className="mt-1 text-xs text-amber-200/70">
              Ask your school admin to publish a timetable version.
            </p>
          </div>
        ) : mode === "week" ? (
          <div className="space-y-4">
            {weekDays.map((day) => {
              const daySlots = sortSlots(day.slots || []);
              return (
                <div key={`${day.dayOfWeek}-${day.date}`} className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="font-medium text-white">{DAY_NAMES[day.dayOfWeek]}</p>
                    <span className="text-xs text-white/55">{formatDateShort(day.date)}</span>
                    <Badge variant="outline" className="border-white/20 text-xs text-white/65">
                      {daySlots.length} slot{daySlots.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  {daySlots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-xs text-white/50">
                      No slots.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <SlotRow
                          key={slot.id}
                          slot={slot}
                          hideClassName={hideClassName}
                          hideTeacherName={hideTeacherName}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {totalSlotsInWeek === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-center text-sm text-white/60">
                {emptyWeekMessage}
              </div>
            ) : null}
          </div>
        ) : selectedDay ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">{DAY_NAMES[selectedDay.dayOfWeek]}</h3>
              <span className="text-sm text-white/60">{formatDateShort(selectedDay.date)}</span>
            </div>

            {selectedDay.slots.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-center text-sm text-white/60">
                {emptyDayMessage}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDay.slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    hideClassName={hideClassName}
                    hideTeacherName={hideTeacherName}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-center text-sm text-white/60">
            {emptyDayMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
