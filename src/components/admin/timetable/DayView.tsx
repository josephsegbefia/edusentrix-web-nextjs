"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, MapPin, Pencil, Plus } from "lucide-react";
import { DAY_NAMES, durationHours, formatTimeLabel, type TimetableEnrichedSlot } from "./types";

type DayViewProps = {
  slots: TimetableEnrichedSlot[];
  selectedDate: Date;
  isDraft: boolean;
  onEditSlot?: (slot: TimetableEnrichedSlot) => void;
  onCreateSlot?: () => void;
};

export function DayView({
  slots,
  selectedDate,
  isDraft,
  onEditSlot,
  onCreateSlot,
}: DayViewProps) {
  const dayOfWeek = selectedDate.getDay();

  const daySlots = React.useMemo(
    () =>
      slots
        .filter((slot) => slot.dayOfWeek === dayOfWeek)
        .sort((a, b) => {
          if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
          return a.classLabel.localeCompare(b.classLabel);
        }),
    [slots, dayOfWeek]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base text-white">
          <span>{DAY_NAMES[dayOfWeek]}</span>
          <span className="text-sm font-normal text-white/60">
            {selectedDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <Badge variant="outline" className="border-white/20 text-white/80">
            {daySlots.length} slot{daySlots.length === 1 ? "" : "s"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {daySlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-black/10 py-10 text-center">
            <CalendarDays className="h-10 w-10 text-white/30" />
            <div>
              <p className="font-medium text-white">No slots for this day</p>
              <p className="text-sm text-white/60">Choose another date or add a slot in draft mode.</p>
            </div>
            {isDraft && onCreateSlot ? (
              <Button onClick={onCreateSlot} className="bg-emerald-500 text-white hover:bg-emerald-400">
                <Plus className="mr-2 h-4 w-4" />
                Add Slot
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {daySlots.map((slot) => {
              const duration = durationHours(slot.startTime, slot.endTime);
              return (
                <div
                  key={slot.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{slot.classLabel}</p>
                        <Badge variant="secondary" className="bg-white/10 text-white/80">
                          {slot.subjectName}
                        </Badge>
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
}
