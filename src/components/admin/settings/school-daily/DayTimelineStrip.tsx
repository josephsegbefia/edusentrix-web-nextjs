"use client";

import * as React from "react";
import { Sun } from "lucide-react";
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

const VARIANT: Record<
  DayStripBlock["variant"],
  { block: string; dot: string; label: string; helper: string; chip: string }
> = {
  opening: {
    block:
      "border-amber-400/25 bg-linear-to-br from-amber-500/[0.18] via-amber-600/[0.08] to-transparent text-amber-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
    dot: "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.35)]",
    label: "Opening",
    helper: "Assembly, registration, or other pre-lesson blocks",
    chip: "border-amber-400/20 bg-amber-400/15 text-amber-100/90",
  },
  teaching: {
    block:
      "border-cyan-400/25 bg-linear-to-br from-cyan-500/[0.18] via-cyan-600/[0.08] to-transparent text-cyan-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
    dot: "bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.35)]",
    label: "Periods",
    helper: "Teaching periods available for timetable lessons",
    chip: "border-cyan-400/20 bg-cyan-400/15 text-cyan-100/90",
  },
  break: {
    block:
      "border-emerald-400/25 bg-linear-to-br from-emerald-500/[0.18] via-emerald-600/[0.08] to-transparent text-emerald-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
    dot: "bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.35)]",
    label: "Breaks",
    helper: "Protected non-teaching break time",
    chip: "border-emerald-400/20 bg-emerald-400/15 text-emerald-100/90",
  },
  gap: {
    block:
      "border-white/12 bg-linear-to-br from-slate-500/[0.12] via-slate-600/[0.06] to-transparent text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    dot: "bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.3)]",
    label: "Unallocated",
    helper: "Slack time not assigned to periods or breaks",
    chip: "border-white/10 bg-white/8 text-slate-200/85",
  },
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
  return blocks
    .map((seg) => {
      const s0 = seg.start < rangeStart ? rangeStart : seg.start;
      const e0 = seg.end > rangeEnd ? rangeEnd : seg.end;
      const minutes = spanMinutes(s0, e0);
      if (minutes <= 0) return null;
      return {
        seg,
        minutes,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

const legendOrder: DayStripBlock["variant"][] = ["opening", "teaching", "break", "gap"];

function splitIntoTwoRows<T>(items: T[]): [T[], T[]] {
  if (items.length <= 1) return [items, []];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

function blockTitleClass(minutes: number) {
  if (minutes <= 20) return "text-[10px] leading-snug sm:text-xs";
  if (minutes <= 40) return "text-xs leading-snug";
  return "text-sm leading-snug";
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

  const [rowA, rowB] = React.useMemo(() => splitIntoTwoRows(layout), [layout]);

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-white/9",
        "bg-linear-to-br from-slate-900/75 via-slate-950/92 to-violet-950/18",
        "p-4 shadow-lg shadow-black/20 sm:p-5",
        "ring-1 ring-inset ring-white/4"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-violet-300/90">
            <Sun className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/70">
              Day preview
            </span>
          </div>
          <div>
            <h4 className="text-base font-semibold tracking-tight text-white sm:text-lg">Timeline</h4>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/50 sm:text-sm">
              {periodsCount} teaching period{periodsCount === 1 ? "" : "s"} in the day. The strip uses the full width;
              the morning half stacks above the afternoon half when there are many blocks.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <PremiumSelect value={weekday} onValueChange={(v) => setWeekday(v as WeekdayKey)}>
            <PremiumSelectTrigger className="h-9 min-w-40 border-white/12 bg-slate-950/50 text-xs text-white">
              <PremiumSelectValue placeholder="Day" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {(
                ["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekdayKey[]
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
            <PremiumSelectTrigger className="h-9 min-w-44 border-white/12 bg-slate-950/50 text-xs text-white">
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

      <div className="flex flex-wrap gap-2">
        {legendOrder.map((variant) => (
          <div
            key={variant}
            className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-slate-950/35 px-2.5 py-1 text-[11px] shadow-sm shadow-black/15"
            title={VARIANT[variant].helper}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", VARIANT[variant].dot)} />
            <span className="font-medium text-white/80">{VARIANT[variant].label}</span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "rounded-2xl border border-white/7 bg-slate-950/40 p-3 sm:p-4",
          "shadow-inner shadow-black/30 ring-1 ring-white/3"
        )}
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/35">
          Full day · proportional widths
        </p>
        <div className="space-y-2">
          {[
            { row: rowA, label: "Earlier / morning" as const },
            { row: rowB, label: "Later / afternoon" as const },
          ].map(
            ({ row, label }) =>
              row.length > 0 && (
                <div key={label} className="space-y-1.5">
                  {rowB.length > 0 ? (
                    <p className="text-[10px] text-white/40">{label}</p>
                  ) : null}
                  <div className="flex w-full flex-nowrap gap-1.5 sm:gap-2">
                    {row.map(({ seg, minutes }) => {
                      const meta = VARIANT[seg.variant];
                      const dupGapLabel = seg.variant === "gap" && seg.label === meta.label;
                      const rowTotalM = Math.max(1, row.reduce((s, x) => s + x.minutes, 0));
                      return (
                        <div
                          key={seg.id}
                          title={`${seg.label} · ${seg.start}–${seg.end}`}
                          style={{
                            flexGrow: minutes,
                            flexShrink: 1,
                            flexBasis: `max(3.25rem, ${(minutes / rowTotalM) * 100}%`,
                          }}
                          className={cn(
                            "flex min-h-21 min-w-0 max-w-full flex-col justify-between rounded-xl border px-2 py-2 sm:min-h-22 sm:px-2.5 sm:py-2.5",
                            "transition-shadow duration-200 hover:shadow-md hover:shadow-black/25",
                            meta.block
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  meta.dot
                                )}
                              />
                              <span
                                className={cn(
                                  "truncate rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                                  meta.chip
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className={cn("mt-1.5 line-clamp-2 font-semibold text-white", blockTitleClass(minutes))}>
                              {dupGapLabel ? "Flexible time" : seg.label}
                            </p>
                          </div>
                          <p className="mt-1.5 truncate font-mono text-[9px] tabular-nums text-white/70 sm:text-[10px]">
                            {seg.start} — {seg.end}
                            <span className="text-white/35"> · </span>
                            {minutes}m
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/38">
        <span className="tabular-nums text-white/55">{rangeStart}</span>
        <span className="mx-1.5 text-white/20">→</span>
        <span className="tabular-nums text-white/55">{rangeEnd}</span>
        <span className="mx-1.5 text-white/25">·</span>
        Staggered breaks may change blocks when you pick a grade.
      </p>
    </div>
  );
}
