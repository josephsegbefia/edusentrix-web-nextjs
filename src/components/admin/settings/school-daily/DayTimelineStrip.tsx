"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { buildDayStripBlocks, type DayStripBlock } from "@/lib/school-day/timeline";
import type { SchoolDailyScheduleConfigV2, WeekdayKey } from "@/types/school-daily-schedule";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

const VARIANT: Record<DayStripBlock["variant"], string> = {
  opening:
    "border border-amber-400/45 bg-gradient-to-b from-amber-500/40 to-amber-900/30 text-amber-50 shadow-sm shadow-amber-950/20",
  teaching:
    "border border-indigo-400/40 bg-gradient-to-b from-indigo-500/40 to-violet-900/25 text-indigo-50 shadow-sm shadow-indigo-950/25",
  break:
    "border border-emerald-400/40 bg-gradient-to-b from-emerald-500/35 to-teal-900/30 text-emerald-50 shadow-sm shadow-emerald-950/20",
  gap:
    "border border-slate-500/50 bg-gradient-to-b from-slate-600/50 to-slate-900/60 text-slate-200 shadow-sm shadow-slate-950/30",
};

type Props = {
  config: SchoolDailyScheduleConfigV2;
  gradeOptions: Array<{ _id: string; name: string }>;
};

function spanMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return eh * 60 + em - (sh * 60 + sm);
}

function layoutBlocks(
  blocks: DayStripBlock[],
  rangeStart: string,
  rangeEnd: string
) {
  const totalM = Math.max(1, spanMinutes(rangeStart, rangeEnd));
  return blocks
    .map((seg) => {
      const s0 = seg.start < rangeStart ? rangeStart : seg.start;
      const e0 = seg.end > rangeEnd ? rangeEnd : seg.end;
      if (spanMinutes(s0, e0) <= 0) return null;
      const startOff = Math.max(0, spanMinutes(rangeStart, s0)) / totalM;
      const w = spanMinutes(s0, e0) / totalM;
      return { seg, left: startOff * 100, width: Math.max(0.35, w * 100) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

export function DayTimelineStrip({ config, gradeOptions }: Props) {
  const [weekday, setWeekday] = React.useState<WeekdayKey>("monday");
  const [gradeId, setGradeId] = React.useState<string | null>(null);
  const { blocks, rangeStart, rangeEnd, periodsCount } = React.useMemo(
    () =>
      buildDayStripBlocks(config, {
        weekday,
        previewGradeId: gradeId,
      }),
    [config, weekday, gradeId]
  );

  const layout = React.useMemo(
    () => layoutBlocks(blocks, rangeStart, rangeEnd),
    [blocks, rangeStart, rangeEnd]
  );

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Day timeline preview</h4>
          <p className="text-xs text-white/50">
            {periodsCount} teaching period{periodsCount === 1 ? "" : "s"} in the window — from first bell to
            end of day. Unallocated time is shown explicitly (slack before timetables assign it).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PremiumSelect
            value={weekday}
            onValueChange={(v) => setWeekday(v as WeekdayKey)}
          >
            <PremiumSelectTrigger className="h-9 w-40 border-white/10 bg-slate-950/60 text-xs text-white">
              <PremiumSelectValue placeholder="Day" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {(
                [
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                ] as WeekdayKey[]
              ).map((d) => (
                <PremiumSelectItem key={d} value={d} className="capitalize">
                  {d}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect
            value={gradeId ?? "__all__"}
            onValueChange={(v) => setGradeId(v === "__all__" ? null : v)}
          >
            <PremiumSelectTrigger className="h-9 min-w-36 border-white/10 bg-slate-950/60 text-xs text-white">
              <PremiumSelectValue placeholder="Preview as grade" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="__all__">All grades (common breaks only)</PremiumSelectItem>
              {gradeOptions.map((g) => (
                <PremiumSelectItem key={g._id} value={g._id}>
                  {g.name}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>
      <div className="relative h-17 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 ring-1 ring-white/5">
        <div className="absolute inset-0">
          {layout.map(({ seg, left, width }) => (
            <div
              key={seg.id}
              title={`${seg.label} · ${seg.start}–${seg.end}`}
              className={cn(
                "absolute top-0 box-border flex h-full min-w-px flex-col items-center justify-center overflow-hidden px-0.5 text-center",
                VARIANT[seg.variant]
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="w-full max-w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">
                {seg.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 w-full text-[8px] font-medium leading-tight sm:text-[9px]",
                  seg.variant === "gap" ? "text-slate-300/95" : "text-white/80"
                )}
              >
                {seg.start} – {seg.end}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-white/40">
        {rangeStart} → {rangeEnd} · Staggered breaks may change blocks when you pick a specific grade.
      </p>
    </div>
  );
}
