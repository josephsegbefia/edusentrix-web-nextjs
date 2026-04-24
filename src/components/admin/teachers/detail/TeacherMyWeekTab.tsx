"use client";

import * as React from "react";
import { AlertTriangle, CalendarDays, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTeacherWeekAgenda } from "@/hooks/admin/useTeacherWeekAgenda";
import { TeacherWeekScheduleCalendar } from "@/components/admin/teachers/detail/TeacherWeekScheduleCalendar";

function mondayContaining(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function parseYmdLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatYmd(date: Date): string {
  const year = date.getFullYear().toString();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekAnchor(): string {
  return formatYmd(mondayContaining(new Date()));
}

function LoadingState() {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/5">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-cyan-500/20" />
          <div className="space-y-2">
            <div className="h-5 w-44 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-72 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="h-14 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-14 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <div className="h-[680px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </CardContent>
    </Card>
  );
}

export function TeacherMyWeekTab({
  teacher,
}: {
  teacher: {
    id: string;
    fullName: string;
  };
}) {
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    currentWeekAnchor()
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useTeacherWeekAgenda(teacher.id, selectedDate);

  const shiftWeek = (deltaWeeks: number) => {
    setSelectedDate((current) =>
      formatYmd(addDays(parseYmdLocal(current), deltaWeeks * 7))
    );
  };

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (isError || !data?.data) {
    return (
      <Card className="border-red-500/20 bg-red-950/20">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Weekly schedule could not be loaded
            </h2>
            <p className="max-w-lg text-sm text-white/60">
              {error instanceof Error
                ? error.message
                : `The weekly schedule for ${teacher.fullName} is unavailable right now.`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-white/55">
        <CalendarDays className="h-4 w-4 text-cyan-300" />
        Teaching lessons repeat weekly from the current academic period.
        Duties remain date-aware and only show on the weeks where they are
        active.
      </div>

      <TeacherWeekScheduleCalendar
        teacherName={teacher.fullName}
        agenda={data.data}
        isFetching={isFetching}
        onPreviousWeek={() => shiftWeek(-1)}
        onNextWeek={() => shiftWeek(1)}
        onCurrentWeek={() => setSelectedDate(currentWeekAnchor())}
      />
    </div>
  );
}
