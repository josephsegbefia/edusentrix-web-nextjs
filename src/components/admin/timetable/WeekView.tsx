"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, MapPin, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES,
  WORKING_DAYS_DEFAULT,
  durationHours,
  formatTimeLabel,
  type TimetableEnrichedSlot,
} from "./types";

type WeekViewProps = {
  slots: TimetableEnrichedSlot[];
  weekStart: Date;
  workingDays?: number[];
  isDraft: boolean;
  onEditSlot?: (slot: TimetableEnrichedSlot) => void;
  onCreateSlot?: () => void;
};

function toDateForDay(weekStart: Date, dayOfWeek: number): Date {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + offset
  );
}

export function WeekView({
  slots,
  weekStart,
  workingDays = [...WORKING_DAYS_DEFAULT],
  isDraft,
  onEditSlot,
  onCreateSlot,
}: WeekViewProps) {
  const slotsByDay = React.useMemo(() => {
    const map = new Map<number, TimetableEnrichedSlot[]>();
    for (const day of workingDays) map.set(day, []);

    for (const slot of slots) {
      if (!map.has(slot.dayOfWeek)) continue;
      const daySlots = map.get(slot.dayOfWeek) || [];
      daySlots.push(slot);
      map.set(slot.dayOfWeek, daySlots);
    }

    for (const day of workingDays) {
      const sorted = (map.get(day) || []).sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.classLabel.localeCompare(b.classLabel);
      });
      map.set(day, sorted);
    }

    return map;
  }, [slots, workingDays]);

  const hasAnySlot = workingDays.some((day) => (slotsByDay.get(day) || []).length > 0);

  if (!hasAnySlot) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <CalendarDays className="h-10 w-10 text-white/30" />
          <div>
            <p className="font-medium text-white">No slots in this week view</p>
            <p className="text-sm text-white/60">Adjust filters or add draft slots to start planning.</p>
          </div>
          {isDraft && onCreateSlot ? (
            <Button onClick={onCreateSlot} className="bg-emerald-500 text-white hover:bg-emerald-400">
              <Plus className="mr-2 h-4 w-4" />
              Add Slot
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {workingDays.map((dayOfWeek) => {
        const daySlots = slotsByDay.get(dayOfWeek) || [];
        const dayDate = toDateForDay(weekStart, dayOfWeek);

        return (
          <Card key={dayOfWeek} className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base text-white">
                <span>{DAY_NAMES[dayOfWeek]}</span>
                <span className="text-sm font-normal text-white/60">
                  {dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <Badge variant="outline" className="border-white/20 text-white/80">
                  {daySlots.length} slot{daySlots.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {daySlots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-4 text-sm text-white/60">
                  No slots for this day.
                </div>
              ) : (
                <div className="space-y-2">
                  {daySlots.map((slot) => {
                    const duration = durationHours(slot.startTime, slot.endTime);
                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "rounded-lg border border-white/10 bg-white/5 p-3",
                          "transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/5"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-white">
                                {slot.classLabel} · {slot.subjectName}
                              </p>
                              {slot.subjectCode ? (
                                <Badge variant="outline" className="border-white/20 text-xs text-white/70">
                                  {slot.subjectCode}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-white/70">{slot.teacherName}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTimeLabel(slot.startTime)} - {formatTimeLabel(slot.endTime)}
                              </span>
                              <span>{duration} hr</span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {slot.classroomLabel}
                              </span>
                            </div>
                          </div>

                          {isDraft && onEditSlot ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                              onClick={() => onEditSlot(slot)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
