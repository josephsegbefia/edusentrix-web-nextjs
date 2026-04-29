"use client";

import { CalendarClock } from "lucide-react";
import { effectivePeriodsFor } from "@/lib/school-day/periods";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

function formatHhmm12(h: string) {
  const m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return h;
  let hour = parseInt(m[1], 10);
  const min = m[2];
  const ap = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ap}`;
}

export function ConfigSummaryView({
  config,
  gradeNames: _gradeNames,
}: {
  config: SchoolDailyScheduleConfigV2;
  gradeNames: (id: string) => string;
}) {
  const def = effectivePeriodsFor(config, "monday", null);
  return (
    <div className="space-y-4 text-sm text-white/80">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-white">
          <CalendarClock className="h-4 w-4 text-violet-300" />
          Default day
        </h3>
        <ul className="ml-1 space-y-1.5 text-white/70">
          <li>
            <span className="text-white/50">First bell (gate):</span> {formatHhmm12(config.dayGateStart)}
          </li>
          <li>
            <span className="text-white/50">Lessons start:</span> {formatHhmm12(config.lessonStart)}
          </li>
          <li>
            <span className="text-white/50">End:</span> {formatHhmm12(config.dayEnd)}
          </li>
          <li>
            <span className="text-white/50">Period length:</span> {config.periodLengthMinutes} min
            {(config.periodLengthOverrides?.length ?? 0) > 0 ? (
              <span className="text-white/45">
                {" "}
                (overrides:{" "}
                {config
                  .periodLengthOverrides!.map((o) => `P${o.periodIndex}=${o.minutes}m`)
                  .join(", ")}
                )
              </span>
            ) : null}
          </li>
          <li>
            <span className="text-white/50">~Periods (sample weekday):</span> {def.fullPeriods}
          </li>
          {(config.openingBlocks?.length ?? 0) > 0 && (
            <li>
              <span className="text-white/50">Non-teaching (before P1):</span>{" "}
              {config.openingBlocks!
                .map((o) => `${o.name} (${o.startTime}–${o.endTime}, ${o.kind})`)
                .join(" · ")}
            </li>
          )}
          <li>
            <span className="text-white/50">Breaks:</span>{" "}
            {config.breaks.length
              ? config.breaks
                  .map((b) => `${b.name} (${b.startTime}–${b.endTime})`)
                  .join(" · ")
              : "None"}
          </li>
        </ul>
      </div>
      {!config.allWeekdaysSame && config.weekdayExceptions.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-white">Exceptions</h3>
          <ul className="space-y-2 text-white/70">
            {config.weekdayExceptions.map((ex) => {
              const p = effectivePeriodsFor(config, ex.weekday, null);
              return (
                <li key={ex.weekday} className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <span className="font-medium capitalize text-violet-200">
                    {ex.weekday}:
                  </span>{" "}
                  {formatHhmm12(ex.lessonStart)}–{formatHhmm12(ex.dayEnd)}, {ex.periodLengthMinutes}{" "}
                  min · ~{p.fullPeriods} period(s) · {ex.breaks.length} break(s)
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
