"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DAY_NAMES, formatTimeLabel } from "@/components/admin/timetable/types";
import { hhmmToMinutes } from "@/lib/school-day/time";
import { toast } from "sonner";
import { UNALLOCATED_GAP_PRESET_OPTIONS } from "@/lib/timetable/unallocated-gap-presets";
import { timeOfDayContext } from "@/lib/timetable/unallocated-gap-time";
import {
  useUnallocatedGapFills,
  useSaveUnallocatedGapFill,
  findFillForGap,
} from "@/hooks/admin/useUnallocatedGapFills";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

const CLEAR_VALUE = "__none__";

type UnallocatedGapActionsProps = {
  classId: string;
  academicPeriodId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  dailyScheduleSettingsHref: string;
  beforeBlockLabel: string;
  afterBlockLabel: string;
};

function gapDurationMinutes(start: string, end: string): number {
  const a = hhmmToMinutes(start.trim());
  const b = hhmmToMinutes(end.trim());
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

export function UnallocatedGapActions({
  classId,
  academicPeriodId,
  dayOfWeek,
  startTime,
  endTime,
  dailyScheduleSettingsHref,
  beforeBlockLabel,
  afterBlockLabel,
}: UnallocatedGapActionsProps) {
  const minutes = gapDurationMinutes(startTime, endTime);
  const dayName = DAY_NAMES[dayOfWeek] ?? "Day";
  const tctx = timeOfDayContext(startTime, dayName);

  const { data, isLoading } = useUnallocatedGapFills(classId);
  const save = useSaveUnallocatedGapFill(classId);

  const selectValue = findFillForGap(data?.fills, dayOfWeek, startTime, endTime)?.presetCode ?? CLEAR_VALUE;

  const [leoText, setLeoText] = React.useState<string | null>(null);
  const [leoLoading, setLeoLoading] = React.useState(false);

  const onPresetChange = async (v: string) => {
    if (v === selectValue) return;
    if (v === CLEAR_VALUE) {
      try {
        await save.mutateAsync({
          dayOfWeek,
          startTime,
          endTime,
          presetCode: null,
        });
        toast.success("Cleared label for this gap");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not clear");
      }
      return;
    }
    try {
      await save.mutateAsync({
        dayOfWeek,
        startTime,
        endTime,
        presetCode: v,
      });
      toast.success("Saved for this grade & day");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  const runLeo = async () => {
    setLeoLoading(true);
    try {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/leo-coach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academicPeriodId,
            gap: {
              dayOfWeek,
              startTime,
              endTime,
              beforeBlock: beforeBlockLabel,
              afterBlock: afterBlockLabel,
              timeOfDayContext: tctx,
            },
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Leo could not respond");
      }
      const text = typeof json?.data?.text === "string" ? json.data.text : "";
      setLeoText(text);
      if (!text) {
        toast.message("Leo had no text to show.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Leo failed");
    } finally {
      setLeoLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-white/50">
        This slice is <span className="text-white/70">unallocated in the day model</span> for this
        class&apos;s grade: it is not a subject cell. Agree a school use below (saved for the whole
        grade for this day and time window) or change the day in{" "}
        <Link href={dailyScheduleSettingsHref} className="text-cyan-300 underline hover:text-cyan-200">
          Daily schedules
        </Link>
        .
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1 space-y-1 sm:max-w-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">
            How we use this time (this grade) · {dayName} · {formatTimeLabel(startTime)}–
            {formatTimeLabel(endTime)}
            {minutes > 0 ? ` · ${minutes} min` : null}
          </p>
          {isLoading ? (
            <p className="text-xs text-white/45">Loading…</p>
          ) : (
            <PremiumSelect
              value={selectValue}
              onValueChange={onPresetChange}
              disabled={save.isPending}
            >
              <PremiumSelectTrigger className="h-8 border-white/10 bg-white/5 text-left text-xs text-white">
                <PremiumSelectValue placeholder="Select a use (optional)…" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value={CLEAR_VALUE} className="text-xs text-white/70">
                  Not set
                </PremiumSelectItem>
                {UNALLOCATED_GAP_PRESET_OPTIONS.map((o) => (
                  <PremiumSelectItem key={o.code} value={o.code} className="text-left text-xs">
                    <span className="block font-medium text-white/95">{o.label}</span>
                    <span className="mt-0.5 block text-[10px] text-white/50">{o.description}</span>
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 border border-white/10 bg-white/5 text-[11px] text-white/80 hover:bg-white/10"
          asChild
        >
          <Link href={dailyScheduleSettingsHref}>Edit day structure</Link>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-amber-400/35 text-[11px] text-amber-100 hover:bg-amber-500/15"
          disabled={leoLoading}
          onClick={runLeo}
        >
          {leoLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 text-amber-200" />
          )}
          <span className="ml-1">Leo: one idea</span>
        </Button>
      </div>

      <p className="text-[10px] leading-relaxed text-white/35">
        For Leo: <span className="text-white/50">After</span> {beforeBlockLabel}{" "}
        <span className="text-white/50">· Before</span> {afterBlockLabel} · {tctx}
      </p>

      {leoText ? (
        <div
          className={cn(
            "relative mt-1 rounded-lg border border-amber-500/20 bg-amber-950/30 px-2.5 py-2 text-[11px] leading-relaxed text-amber-50/95"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-0.5 h-7 w-7 text-amber-200/70 hover:bg-amber-500/20 hover:text-amber-50"
            onClick={() => setLeoText(null)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <p className="pr-6 whitespace-pre-wrap">{leoText}</p>
        </div>
      ) : null}
    </div>
  );
}
