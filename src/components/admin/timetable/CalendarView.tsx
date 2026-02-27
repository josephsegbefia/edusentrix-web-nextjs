"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_SHORT } from "./types";

type CalendarViewProps = {
  monthDate: Date;
  selectedDate: Date;
  weekdaySlotCounts: Record<number, number>;
  onSelectDate: (date: Date) => void;
  onMonthChange: (nextMonthDate: Date) => void;
};

export function CalendarView({
  monthDate,
  selectedDate,
  weekdaySlotCounts,
  onSelectDate,
  onMonthChange,
}: CalendarViewProps) {
  const firstOfMonth = React.useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    [monthDate]
  );

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const daysInMonth = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth() + 1,
    0
  ).getDate();

  const leadingBlankCells = firstOfMonth.getDay();
  const today = new Date();

  const cells = [
    ...Array.from({ length: leadingBlankCells }, () => null),
    ...Array.from({ length: daysInMonth }, (_, idx) => idx + 1),
  ];

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base text-white">Calendar View</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/20 bg-transparent text-white/80 hover:bg-white/10"
              onClick={() =>
                onMonthChange(new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="border-white/20 text-white/80">
              {monthLabel}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/20 bg-transparent text-white/80 hover:bg-white/10"
              onClick={() =>
                onMonthChange(new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-white/60">
          {DAY_SHORT.map((day) => (
            <div key={day} className="py-1 font-medium">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((dayNumber, idx) => {
            if (dayNumber === null) {
              return <div key={`blank-${idx}`} className="h-16 rounded-lg border border-transparent" />;
            }

            const currentDate = new Date(
              firstOfMonth.getFullYear(),
              firstOfMonth.getMonth(),
              dayNumber
            );

            const dayOfWeek = currentDate.getDay();
            const slotCount = weekdaySlotCounts[dayOfWeek] || 0;
            const isSelected =
              selectedDate.getFullYear() === currentDate.getFullYear() &&
              selectedDate.getMonth() === currentDate.getMonth() &&
              selectedDate.getDate() === currentDate.getDate();
            const isToday =
              today.getFullYear() === currentDate.getFullYear() &&
              today.getMonth() === currentDate.getMonth() &&
              today.getDate() === currentDate.getDate();

            return (
              <button
                key={`day-${dayNumber}`}
                type="button"
                onClick={() => onSelectDate(currentDate)}
                className={cn(
                  "flex h-16 flex-col items-start justify-between rounded-lg border p-2 text-left transition-colors",
                  "border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-emerald-500/10",
                  isSelected && "border-emerald-400 bg-emerald-500/20",
                  isToday && !isSelected && "border-amber-400/60"
                )}
              >
                <span className="text-sm font-semibold text-white">{dayNumber}</span>
                <span className="text-[11px] text-white/70">
                  {slotCount} slot{slotCount === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
