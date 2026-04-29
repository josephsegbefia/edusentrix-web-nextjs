"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { effectivePeriodsFor, validateBreaksInWindow } from "@/lib/school-day/periods";
import { validateOpeningBlocks } from "@/lib/school-day/opening-validation";
import {
  createDefaultV2Config,
  ensureConfigV2,
  prepareSchoolDailyConfigForApi,
} from "@/lib/school-day/migrate-v2";
import { DayTimelineStrip } from "./DayTimelineStrip";
import {
  type DailyBreakItemV2,
  type OpeningBlock,
  type SchoolDailyScheduleConfigV2,
  type WeekdayKey,
} from "@/types/school-daily-schedule";
import type { DailyBreakItem } from "@/types/school-daily-schedule";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";

const PRESET_PERIODS = [30, 35, 40, 45, 50, 55, 60] as const;
function isPresetPeriodMinutes(n: number) {
  return (PRESET_PERIODS as readonly number[]).includes(n);
}

const WEEKDAYS: { key: WeekdayKey; short: string }[] = [
  { key: "monday", short: "Mon" },
  { key: "tuesday", short: "Tue" },
  { key: "wednesday", short: "Wed" },
  { key: "thursday", short: "Thu" },
  { key: "friday", short: "Fri" },
  { key: "saturday", short: "Sat" },
  { key: "sunday", short: "Sun" },
];

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedExceptionFrom(
  base: SchoolDailyScheduleConfigV2,
  weekday: WeekdayKey
): SchoolDailyScheduleConfigV2["weekdayExceptions"][0] {
  return {
    weekday,
    dayGateStart: base.dayGateStart,
    lessonStart: base.lessonStart,
    dayEnd: base.dayEnd,
    periodLengthMinutes: base.periodLengthMinutes,
    periodLengthOverrides: [...(base.periodLengthOverrides ?? [])],
    openingBlocks: (base.openingBlocks ?? []).map((o) => ({ ...o, id: newId() })),
    breaks: base.breaks.map((b) => {
      const { appliesToGradeIds: _g, ...rest } = b;
      return { ...rest, id: newId() };
    }),
  };
}

export type SchoolDailySaveMeta = {
  changeLabel?: string;
  academicPeriodId?: string;
};

type Props = {
  initial: SchoolDailyScheduleConfigV2 | null;
  gradeOptions: Array<{ _id: string; name: string }>;
  saving: boolean;
  onCancel: () => void;
  onSave: (config: SchoolDailyScheduleConfigV2, meta?: SchoolDailySaveMeta) => void | Promise<void>;
  /** Omit changeLabel / academicPeriodId on save — parent collects metadata. */
  embedMode?: boolean;
  finishButtonLabel?: string;
};

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

function summarizeBreaks(br: DailyBreakItemV2[]) {
  if (!br.length) return "No breaks";
  return br.map((b) => `${b.name} (${b.startTime}–${b.endTime})`).join(", ");
}

export function SchoolDailyScheduleWizard({
  initial,
  gradeOptions,
  saving,
  onCancel,
  onSave,
  embedMode = false,
  finishButtonLabel,
}: Props) {
  const [step, setStep] = React.useState(1);
  const [draft, setDraft] = React.useState<SchoolDailyScheduleConfigV2>(() => {
    const base = initial ? ensureConfigV2(initial) : createDefaultV2Config();
    return {
      ...base,
      hasGradeOverrides: false,
      gradeOverrides: [],
      breaks: base.breaks.map(({ appliesToGradeIds: _a, ...b }) => b),
      weekdayExceptions: base.weekdayExceptions.map((ex) => ({
        ...ex,
        breaks: ex.breaks.map(({ appliesToGradeIds: _b, ...bb }) => bb),
      })),
    };
  });

  const [breakName, setBreakName] = React.useState("");
  const [breakStart, setBreakStart] = React.useState("10:00");
  const [breakEnd, setBreakEnd] = React.useState("10:20");
  const [breakExampleKey, setBreakExampleKey] = React.useState(0);

  const [obName, setObName] = React.useState("");
  const [obKind, setObKind] = React.useState<OpeningBlock["kind"]>("registration");
  const [obStart, setObStart] = React.useState("08:00");
  const [obEnd, setObEnd] = React.useState("08:15");

  const [ovIndex, setOvIndex] = React.useState(1);
  const [ovMinutes, setOvMinutes] = React.useState(35);

  const [changeLabel, setChangeLabel] = React.useState("");
  const [academicPeriodId, setAcademicPeriodId] = React.useState("");

  const setBase = (patch: Partial<SchoolDailyScheduleConfigV2>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const defaultEstimate = React.useMemo(
    () => effectivePeriodsFor(draft, "monday", null),
    [draft]
  );

  const canGoFromStep1 = React.useMemo(() => {
    const open = validateOpeningBlocks(
      draft.dayGateStart,
      draft.lessonStart,
      draft.openingBlocks ?? []
    );
    if (!open.ok) return false;
    const toMin = (h: string) => {
      const p = h.match(/^(\d{1,2}):(\d{2})$/);
      if (!p) return Number.NaN;
      return parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    };
    if (toMin(draft.lessonStart) >= toMin(draft.dayEnd)) return false;
    return true;
  }, [draft]);

  const step1ErrorMessage = React.useMemo(() => {
    const o = validateOpeningBlocks(
      draft.dayGateStart,
      draft.lessonStart,
      draft.openingBlocks ?? []
    );
    if (!o.ok) return o.error;
    const toMin = (h: string) => {
      const p = h.match(/^(\d{1,2}):(\d{2})$/);
      if (!p) return Number.NaN;
      return parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    };
    if (toMin(draft.lessonStart) >= toMin(draft.dayEnd)) {
      return "The school day end must be after lessons start.";
    }
    return null;
  }, [draft]);

  const canGoFromStep2 = React.useMemo(
    () =>
      validateBreaksInWindow(
        draft.lessonStart,
        draft.dayEnd,
        draft.breaks as DailyBreakItem[]
      ).ok,
    [draft]
  );

  const canGoFromStep3 = !draft.allWeekdaysSame
    ? draft.weekdayExceptions.length > 0 &&
      draft.weekdayExceptions.every((ex) =>
        validateBreaksInWindow(
          ex.lessonStart,
          ex.dayEnd,
          ex.breaks as DailyBreakItem[]
        ).ok
      )
    : true;

  const canFinish = canGoFromStep1 && canGoFromStep2 && canGoFromStep3;

  const addBreak = () => {
    if (!breakName.trim()) return;
    const b: DailyBreakItemV2 = {
      id: newId(),
      name: breakName.trim(),
      startTime: breakStart,
      endTime: breakEnd,
    };
    setDraft((d) => ({ ...d, breaks: [...d.breaks, b] }));
    setBreakName("");
  };

  const removeBreak = (id: string) => {
    setDraft((d) => ({
      ...d,
      breaks: d.breaks.filter((b) => b.id !== id),
    }));
  };

  const toggleDifferingDay = (day: WeekdayKey) => {
    setDraft((d) => {
      const has = d.weekdayExceptions.some((e) => e.weekday === day);
      if (has) {
        return {
          ...d,
          weekdayExceptions: d.weekdayExceptions.filter((e) => e.weekday !== day),
        };
      }
      return {
        ...d,
        weekdayExceptions: [
          ...d.weekdayExceptions,
          seedExceptionFrom(d, day),
        ],
      };
    });
  };

  const patchException = (
    day: WeekdayKey,
    patch: Partial<SchoolDailyScheduleConfigV2["weekdayExceptions"][0]>
  ) => {
    setDraft((d) => ({
      ...d,
      weekdayExceptions: d.weekdayExceptions.map((e) =>
        e.weekday === day ? { ...e, ...patch } : e
      ),
    }));
  };

  const addExceptionBreak = (day: WeekdayKey) => {
    const b: DailyBreakItemV2 = {
      id: newId(),
      name: "Break",
      startTime: "10:00",
      endTime: "10:20",
    };
    setDraft((d) => ({
      ...d,
      weekdayExceptions: d.weekdayExceptions.map((e) =>
        e.weekday === day ? { ...e, breaks: [...e.breaks, b] } : e
      ),
    }));
  };

  const removeExceptionBreak = (day: WeekdayKey, id: string) => {
    setDraft((d) => ({
      ...d,
      weekdayExceptions: d.weekdayExceptions.map((e) =>
        e.weekday === day
          ? { ...e, breaks: e.breaks.filter((x) => x.id !== id) }
          : e
      ),
    }));
  };

  const runSave = () => {
    const normalizedBreaks = draft.breaks.map(({ appliesToGradeIds: _a, ...b }) => b);
    const normalizedExceptions = draft.allWeekdaysSame
      ? []
      : draft.weekdayExceptions.map((ex) => ({
          ...ex,
          breaks: ex.breaks.map(({ appliesToGradeIds: _b, ...bb }) => bb),
        }));
    const config: SchoolDailyScheduleConfigV2 = prepareSchoolDailyConfigForApi({
      ...draft,
      version: 2,
      allWeekdaysSame: draft.allWeekdaysSame,
      weekdayExceptions: normalizedExceptions,
      breaks: normalizedBreaks,
      hasGradeOverrides: false,
      gradeOverrides: [],
    });
    return onSave(config, embedMode ? {} : {
      changeLabel: changeLabel.trim() || undefined,
      academicPeriodId: academicPeriodId.trim() || undefined,
    });
  };

  const next = () => {
    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      void runSave();
    }
  };

  const back = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  return (
    <Card className="border border-violet-500/20 bg-slate-950/80 backdrop-blur">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300/90">
              Step {step} of 4
            </p>
            <h2 className="text-lg font-semibold text-white">
              {step === 1 && "Basic school day"}
              {step === 2 && "Breaks"}
              {step === 3 && "Weekday exceptions"}
              {step === 4 && "Review & confirm"}
            </h2>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full",
                  i < step ? "bg-violet-500" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-1">
              <Label className="text-white/80">First bell / day gate (before teaching)</Label>
              <Input
                type="time"
                value={draft.dayGateStart}
                onChange={(e) => setBase({ dayGateStart: e.target.value })}
                className="border-white/10 bg-white/5 text-white"
              />
              <p className="text-[11px] text-white/40">Assembly, registration, or other non-lesson time can sit after this and before the first period.</p>
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label className="text-white/80">What time does period 1 (teaching) start?</Label>
              <Input
                type="time"
                value={draft.lessonStart}
                onChange={(e) => setBase({ lessonStart: e.target.value })}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label className="text-white/80">What time does the school day usually end?</Label>
              <Input
                type="time"
                value={draft.dayEnd}
                onChange={(e) => setBase({ dayEnd: e.target.value })}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 sm:max-w-2xl">
              <Label className="text-white/80">How long is one period (minutes)?</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <PremiumSelect
                  value={
                    isPresetPeriodMinutes(draft.periodLengthMinutes)
                      ? String(draft.periodLengthMinutes)
                      : "custom"
                  }
                  onValueChange={(v) => {
                    if (v === "custom") return;
                    setBase({ periodLengthMinutes: Number(v) });
                  }}
                >
                  <PremiumSelectTrigger className="h-10 w-full min-w-[220px] border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Period length" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {PRESET_PERIODS.map((n) => (
                      <PremiumSelectItem key={n} value={String(n)}>
                        {n} minutes
                      </PremiumSelectItem>
                    ))}
                    <PremiumSelectItem value="custom">Custom…</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
                <div className="space-y-1">
                  <Label className="text-[11px] text-white/40">Exact minutes</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={draft.periodLengthMinutes}
                    onChange={(e) =>
                      setBase({ periodLengthMinutes: Number(e.target.value) || 0 })
                    }
                    className="h-10 max-w-32 border-white/10 bg-white/5 text-white"
                    aria-label="Period length in minutes"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-sm font-medium text-white/90">Non-teaching time before first period</p>
              <p className="text-xs text-white/45">Optional blocks such as assembly or registration. They are not &quot;breaks&quot; and sit between first bell and the start of period 1.</p>
              <ul className="space-y-1.5">
                {(draft.openingBlocks ?? []).map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1.5 text-xs text-white/80"
                  >
                    <span>
                      <span className="font-medium">{o.name}</span>{" "}
                      <span className="text-white/50">
                        ({o.kind}) {o.startTime}–{o.endTime}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-300"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          openingBlocks: (d.openingBlocks ?? []).filter((x) => x.id !== o.id),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
                {(draft.openingBlocks?.length ?? 0) === 0 && (
                  <li className="text-xs text-white/40">No opening blocks. First bell and lessons start are the only anchors.</li>
                )}
              </ul>
              <div className="mt-2 grid gap-2 rounded border border-dashed border-white/15 p-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-white/50">Name</Label>
                  <Input
                    value={obName}
                    onChange={(e) => setObName(e.target.value)}
                    placeholder="e.g. Assembly"
                    className="border-white/10 bg-slate-950/60 text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-white/50">Kind</Label>
                  <PremiumSelect
                    value={obKind}
                    onValueChange={(v) => setObKind(v as OpeningBlock["kind"])}
                  >
                    <PremiumSelectTrigger className="h-9 border-white/10 bg-slate-950/60 text-xs text-white">
                      <PremiumSelectValue />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="assembly">assembly</PremiumSelectItem>
                      <PremiumSelectItem value="registration">registration</PremiumSelectItem>
                      <PremiumSelectItem value="other">other</PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-[11px] text-white/50">Start</Label>
                    <Input
                      type="time"
                      value={obStart}
                      onChange={(e) => setObStart(e.target.value)}
                      className="h-9 border-white/10 bg-slate-950/60 text-white"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-[11px] text-white/50">End</Label>
                    <Input
                      type="time"
                      value={obEnd}
                      onChange={(e) => setObEnd(e.target.value)}
                      className="h-9 border-white/10 bg-slate-950/60 text-white"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!obName.trim()) return;
                      const b: OpeningBlock = {
                        id: newId(),
                        name: obName.trim(),
                        kind: obKind,
                        startTime: obStart,
                        endTime: obEnd,
                      };
                      setDraft((d) => ({ ...d, openingBlocks: [...(d.openingBlocks ?? []), b] }));
                      setObName("");
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add block
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-sm font-medium text-white/90">Period length overrides</p>
              <p className="text-xs text-white/45">Make only certain periods shorter or longer (e.g. first period) without duplicating a whole weekday.</p>
              <ul className="space-y-1.5 text-xs text-white/70">
                {(draft.periodLengthOverrides ?? []).map((o) => (
                  <li key={o.periodIndex} className="flex items-center justify-between gap-2 rounded border border-white/5 bg-slate-950/50 px-2 py-1">
                    <span>
                      Period {o.periodIndex}: {o.minutes} min
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-300"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          periodLengthOverrides: (d.periodLengthOverrides ?? []).filter(
                            (x) => x.periodIndex !== o.periodIndex
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
                {(draft.periodLengthOverrides?.length ?? 0) === 0 && (
                  <li className="text-white/40">All periods use the default length above.</li>
                )}
              </ul>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-white/50">Period #</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={ovIndex}
                    onChange={(e) => setOvIndex(Number(e.target.value) || 1)}
                    className="h-9 w-20 border-white/10 bg-slate-950/60 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-white/50">Minutes</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={ovMinutes}
                    onChange={(e) => setOvMinutes(Number(e.target.value) || 0)}
                    className="h-9 w-24 border-white/10 bg-slate-950/60 text-white"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-5"
                  variant="secondary"
                  onClick={() => {
                    const n = Math.max(1, Math.min(20, ovIndex));
                    const mins = Math.max(5, Math.min(120, ovMinutes));
                    setDraft((d) => {
                      const rest = (d.periodLengthOverrides ?? []).filter((x) => x.periodIndex !== n);
                      return { ...d, periodLengthOverrides: [...rest, { periodIndex: n, minutes: mins }] };
                    });
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Set override
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:col-span-2">
              <p className="text-sm font-medium text-emerald-200">
                Estimated teaching periods: {defaultEstimate.fullPeriods}
                {defaultEstimate.hasPartialRemainder
                  ? ` (with ${defaultEstimate.remainderTeachingMinutes} min remaining)`
                  : null}
              </p>
              <p className="mt-1 text-xs text-emerald-200/80">
                We subtract break time, then use your default and any per-period overrides. You can add breaks in
                the next step.
              </p>
            </div>
            {!canGoFromStep1 && step1ErrorMessage && (
              <p className="text-sm text-amber-200 sm:col-span-2">{step1ErrorMessage}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Add breaks one at a time (e.g. morning break, lunch). They block teaching time and reduce how many
              periods fit in the day. Each schedule group uses this pattern for every grade in that group — use
              separate groups in the previous flow if bell times differ by band.
            </p>
            <div className="space-y-2 max-w-md">
              <Label className="text-white/50 text-xs">Prefill from an example (optional)</Label>
              <PremiumSelect
                key={breakExampleKey}
                onValueChange={(v) => {
                  if (v === "morning") {
                    setBreakName("Morning break");
                    setBreakStart("10:00");
                    setBreakEnd("10:20");
                  } else if (v === "lunch") {
                    setBreakName("Lunch");
                    setBreakStart("12:00");
                    setBreakEnd("12:40");
                  } else if (v === "afternoon") {
                    setBreakName("Afternoon break");
                    setBreakStart("14:00");
                    setBreakEnd("14:15");
                  }
                  setBreakExampleKey((k) => k + 1);
                }}
              >
                <PremiumSelectTrigger className="h-10 w-full border-white/10 bg-white/5 text-white">
                  <PremiumSelectValue placeholder="Choose a template…" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="morning">Morning break (10:00–10:20)</PremiumSelectItem>
                  <PremiumSelectItem value="lunch">Lunch (12:00–12:40)</PremiumSelectItem>
                  <PremiumSelectItem value="afternoon">Afternoon break (14:00–14:15)</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <ul className="space-y-2">
              {draft.breaks.length === 0 && (
                <li className="text-sm text-white/40">No breaks added yet.</li>
              )}
              {draft.breaks.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-white">
                    <span className="font-medium">{b.name}</span>{" "}
                    <span className="text-white/60">
                      {b.startTime} – {b.endTime}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-rose-300"
                    onClick={() => removeBreak(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 rounded-xl border border-dashed border-white/15 p-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/80">Break name</Label>
                <Input
                  value={breakName}
                  onChange={(e) => setBreakName(e.target.value)}
                  placeholder="e.g. Morning break"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Start</Label>
                <Input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">End</Label>
                <Input
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" variant="secondary" className="w-full" onClick={addBreak}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add this break
                </Button>
              </div>
            </div>
            {!canGoFromStep2 && (
              <p className="text-sm text-amber-200">
                Fix break times: each must be inside the school day and not overlap.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/70">Do all weekdays follow the same schedule?</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Different by day</span>
                <Switch
                  checked={!draft.allWeekdaysSame}
                  onCheckedChange={(v) => {
                    if (!v) {
                      setBase({ allWeekdaysSame: true, weekdayExceptions: [] });
                    } else {
                      setBase({ allWeekdaysSame: false });
                    }
                  }}
                />
              </div>
            </div>
            {!draft.allWeekdaysSame && (
              <div className="space-y-3">
                <p className="text-sm text-white/60">
                  Tap the days that use a different start, end, period length, or breaks. You only configure
                  those days — the rest use your default from step 1–2.
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(({ key, short }) => {
                    const on = draft.weekdayExceptions.some((e) => e.weekday === key);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => toggleDifferingDay(key)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                          on
                            ? "border-violet-500/50 bg-violet-500/20 text-violet-100"
                            : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                        )}
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
                {draft.weekdayExceptions.map((ex) => (
                  <div
                    key={ex.weekday}
                    className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="capitalize">
                        {ex.weekday}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-white/60">Lessons start</Label>
                        <Input
                          type="time"
                          value={ex.lessonStart}
                          onChange={(e) =>
                            patchException(ex.weekday, { lessonStart: e.target.value })
                          }
                          className="border-white/10 bg-slate-950/60 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-white/60">Day ends</Label>
                        <Input
                          type="time"
                          value={ex.dayEnd}
                          onChange={(e) => patchException(ex.weekday, { dayEnd: e.target.value })}
                          className="border-white/10 bg-slate-950/60 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-white/60">Period (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={120}
                          value={ex.periodLengthMinutes}
                          onChange={(e) =>
                            patchException(ex.weekday, {
                              periodLengthMinutes: Number(e.target.value) || 0,
                            })
                          }
                          className="border-white/10 bg-slate-950/60 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Breaks for this day</Label>
                      {ex.breaks.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-wrap items-end gap-2 rounded-lg border border-white/5 bg-slate-950/40 p-2"
                        >
                          <Input
                            value={b.name}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                weekdayExceptions: d.weekdayExceptions.map((x) =>
                                  x.weekday === ex.weekday
                                    ? {
                                        ...x,
                                        breaks: x.breaks.map((bb) =>
                                          bb.id === b.id
                                            ? { ...bb, name: e.target.value }
                                            : bb
                                        ),
                                      }
                                    : x
                                ),
                              }))
                            }
                            className="h-9 max-w-xs border-white/10 bg-slate-950/60 text-sm text-white"
                            placeholder="Name"
                          />
                          <Input
                            type="time"
                            value={b.startTime}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                weekdayExceptions: d.weekdayExceptions.map((x) =>
                                  x.weekday === ex.weekday
                                    ? {
                                        ...x,
                                        breaks: x.breaks.map((bb) =>
                                          bb.id === b.id
                                            ? { ...bb, startTime: e.target.value }
                                            : bb
                                        ),
                                      }
                                    : x
                                ),
                              }))
                            }
                            className="h-9 w-28 border-white/10 bg-slate-950/60 text-sm text-white"
                          />
                          <Input
                            type="time"
                            value={b.endTime}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                weekdayExceptions: d.weekdayExceptions.map((x) =>
                                  x.weekday === ex.weekday
                                    ? {
                                        ...x,
                                        breaks: x.breaks.map((bb) =>
                                          bb.id === b.id
                                            ? { ...bb, endTime: e.target.value }
                                            : bb
                                        ),
                                      }
                                    : x
                                ),
                              }))
                            }
                            className="h-9 w-28 border-white/10 bg-slate-950/60 text-sm text-white"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeExceptionBreak(ex.weekday, b.id)}
                            className="h-9 text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addExceptionBreak(ex.weekday)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add break
                      </Button>
                    </div>
                    <p className="text-xs text-white/40">
                      Periods:{" "}
                      {effectivePeriodsFor(ensureConfigV2(draft), ex.weekday, null).fullPeriods}
                    </p>
                  </div>
                ))}
                {!canGoFromStep3 && (
                  <p className="text-sm text-amber-200">Select and complete at least one different weekday, or turn off exceptions.</p>
                )}
              </div>
            )}
          </div>
        )}


        {step === 4 && (
          <div className="space-y-4 text-sm text-white/80">
            <DayTimelineStrip config={ensureConfigV2(draft)} gradeOptions={gradeOptions} />
            {!embedMode && (
            <div className="space-y-2">
              <Label className="text-white/60">Version note (optional)</Label>
              <Input
                value={changeLabel}
                onChange={(e) => setChangeLabel(e.target.value)}
                placeholder="e.g. Term 1 2026, post-assembly change"
                className="border-white/10 bg-slate-950/50 text-sm text-white"
              />
              <p className="text-[11px] text-white/40">
                Saved with the previous snapshot in history so you can tell which rule set was active.
              </p>
            </div>
            )}
            {!embedMode && (
            <div className="space-y-2">
              <Label className="text-white/60">Academic period ID (optional)</Label>
              <Input
                value={academicPeriodId}
                onChange={(e) => setAcademicPeriodId(e.target.value)}
                placeholder="Link to a term/semester if your school uses that record"
                className="border-white/10 bg-slate-950/50 text-sm text-white"
              />
            </div>
            )}
            <div>
              <h3 className="mb-2 font-semibold text-white">Default school day</h3>
              <ul className="list-inside list-disc space-y-1 text-white/70">
                <li>First bell: {formatHhmm12(draft.dayGateStart)}</li>
                <li>Period 1 starts: {formatHhmm12(draft.lessonStart)}</li>
                <li>End: {formatHhmm12(draft.dayEnd)}</li>
                <li>Default period length: {draft.periodLengthMinutes} minutes</li>
                <li>~{defaultEstimate.fullPeriods} teaching period(s) (sample Mon, default group)</li>
                <li>Breaks: {summarizeBreaks(draft.breaks)}</li>
              </ul>
            </div>
            {!draft.allWeekdaysSame && (
              <div>
                <h3 className="mb-2 font-semibold text-white">Exceptions</h3>
                <ul className="space-y-2">
                  {draft.weekdayExceptions.map((ex) => (
                    <li key={ex.weekday} className="text-white/70">
                      <span className="font-medium capitalize text-violet-200">
                        {ex.weekday}:
                      </span>{" "}
                      {formatHhmm12(ex.lessonStart)}–{formatHhmm12(ex.dayEnd)},{" "}
                      {ex.periodLengthMinutes} min periods, {ex.breaks.length} break(s), ~
                      {effectivePeriodsFor(ensureConfigV2(draft), ex.weekday, null).fullPeriods}{" "}
                      periods
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-white/50">
              {embedMode
                ? "This pattern applies only to the schedule group you are editing."
                : "Saving applies this as the school-wide day pattern (with exceptions) for future timetables and scheduling features."}
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={back}
                className="border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                type="button"
                onClick={next}
                disabled={
                  (step === 1 && !canGoFromStep1) ||
                  (step === 2 && !canGoFromStep2) ||
                  (step === 3 && !canGoFromStep3)
                }
                className="bg-violet-600 hover:bg-violet-500"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void runSave()}
                disabled={saving || !canFinish}
                className="bg-linear-to-r from-violet-500 to-purple-600"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  finishButtonLabel ?? "Save daily schedule"
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
