"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { useSchool } from "@/hooks/admin/useSchool";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  useDeleteSchoolDailySchedule,
  useSaveSchoolDailySchedule,
  useSchoolDailySchedule,
} from "@/hooks/admin/useSchoolDailySchedule";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import { SchoolDailyScheduleWizard } from "./SchoolDailyScheduleWizard";
import { DayTimelineStrip } from "./DayTimelineStrip";
import { effectivePeriodsFor } from "@/lib/school-day/periods";
import type { SchoolDailyScheduleConfigV2, WeekdayKey } from "@/types/school-daily-schedule";
import { Pencil, Trash2, CalendarClock, Loader2, Sparkles, History } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_DAYS: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

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

function ConfigSummaryView({
  config,
  gradeNames,
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
                  .map((b) => {
                    const sc =
                      b.appliesToGradeIds && b.appliesToGradeIds.length
                        ? ` [${b.appliesToGradeIds.map(gradeNames).filter(Boolean).join(", ") || "grades"}]`
                        : "";
                    return `${b.name} (${b.startTime}–${b.endTime})${sc}`;
                  })
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
      {config.hasGradeOverrides && config.gradeOverrides.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-white">Grade overrides</h3>
          <ul className="space-y-1.5 text-white/70">
            {config.gradeOverrides.map((g, idx) => {
              const gAny = g as { gradeIds?: string[]; gradeId?: string };
              const ids =
                gAny.gradeIds && gAny.gradeIds.length > 0
                  ? gAny.gradeIds
                  : gAny.gradeId
                    ? [gAny.gradeId]
                    : [];
              const name = ids
                .map((id) => gradeNames(id) || id)
                .filter(Boolean)
                .join(", ");
              const parts: string[] = [];
              if (g.dayGateStart) parts.push(`first bell ${g.dayGateStart}`);
              if (g.lessonStart) parts.push(`lessons start ${g.lessonStart}`);
              if (g.dayEnd) parts.push(`end ${g.dayEnd}`);
              if (g.periodLengthMinutes != null) parts.push(`default period ${g.periodLengthMinutes}m`);
              if (g.openingBlocks && g.openingBlocks.length) {
                parts.push(
                  `opening: ${g.openingBlocks.map((o) => o.name).join(", ")}`
                );
              }
              if (g.periodLengthOverrides && g.periodLengthOverrides.length) {
                parts.push(
                  `per-period: ${g.periodLengthOverrides
                    .map((o) => `P${o.periodIndex}=${o.minutes}m`)
                    .join(", ")}`
                );
              }
              if (g.breaks && g.breaks.length) parts.push("custom breaks");
              return (
                <li key={ids.length ? [...ids].sort().join("-") : `go-${idx}`}>
                  <span className="text-violet-200">{name || "—"}</span>: {parts.join(" · ")}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SchoolDailySchedulePanel() {
  const { data: school } = useSchool();
  const { data: row, isLoading, isError, refetch } = useSchoolDailySchedule();
  const { data: grades = [] } = useGradeOptions();
  const save = useSaveSchoolDailySchedule();
  const del = useDeleteSchoolDailySchedule();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editInitial, setEditInitial] = React.useState<SchoolDailyScheduleConfigV2 | null>(null);

  const schoolName = school?.data?.name || "your school";
  const gradeNames = React.useCallback(
    (id: string) => grades.find((g) => g._id === id)?.name || "",
    [grades]
  );

  const startNew = () => {
    setEditInitial(null);
    setWizardOpen(true);
  };

  const startEdit = async () => {
    if (!row?.config) return;
    const res = await confirm({
      title: "Edit daily schedule?",
      description:
        "Changes here update the school’s teaching window, breaks, and period count. Class timetables and automated scheduling will use the new limits — existing drafts may need review.",
      confirmLabel: "Continue",
      cancelLabel: "Back",
      intent: "warning",
    });
    if (res !== "confirm") return;
    setEditInitial(row.config);
    setWizardOpen(true);
  };

  const handleDelete = async () => {
    const res = await confirm({
      title: "Delete the daily schedule?",
      description:
        "Removing the daily schedule deletes your saved pattern and period rules. The timetable system will not have a school-wide day to align to until you set it up again. This does not delete existing timetable drafts by itself, but new work should assume no schedule is configured.",
      confirmLabel: "Delete schedule",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (res !== "confirm") return;
    try {
      await busy.promise(del.mutateAsync(), {
        loading: "Deleting…",
        success: "Daily schedule removed.",
        error: (e: Error) => e.message,
      });
    } catch {
      // toast
    }
  };

  const handleSave = async (
    config: SchoolDailyScheduleConfigV2,
    meta?: { changeLabel?: string; academicPeriodId?: string }
  ) => {
    try {
      const out = await busy.promise(
        save.mutateAsync({
          config,
          changeLabel: meta?.changeLabel,
          academicPeriodId: meta?.academicPeriodId,
        }),
        {
          loading: "Saving…",
          success: "Daily schedule saved.",
          error: (e: Error) => e.message,
        }
      );
      if (out.warnings?.length) {
        for (const w of out.warnings) {
          toast.message("Schedule note", { description: w });
        }
      }
      setWizardOpen(false);
      setEditInitial(null);
      void refetch();
    } catch {
      // busy toast
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-rose-300">Could not load the daily schedule. Try again later.</p>
    );
  }

  if (wizardOpen) {
    return (
      <>
        {confirmationDialog}
        <SchoolDailyScheduleWizard
          key={editInitial ? "edit" : "new"}
          initial={editInitial}
          gradeOptions={grades}
          saving={save.isPending}
          onCancel={() => {
            setWizardOpen(false);
            setEditInitial(null);
          }}
          onSave={handleSave}
        />
      </>
    );
  }

  if (!row) {
    return (
      <>
        {confirmationDialog}
        <Card className="overflow-hidden border border-violet-500/20 bg-linear-to-br from-violet-500/10 via-slate-950/90 to-slate-950/95">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/20">
                <LeoIcon className="h-8 w-8 text-violet-200" />
              </div>
              <div className="min-w-0 space-y-2">
                <h3 className="text-lg font-semibold text-white sm:text-xl">
                  Let’s set up {schoolName}&apos;s daily schedule
                </h3>
                <p className="text-sm leading-relaxed text-white/65">
                  A clear school day (start, end, period length, and breaks) tells the system how many teaching
                  periods exist each day, so class timetables and future scheduling stay realistic and
                  consistent with how your school actually runs.
                </p>
                <p className="text-xs text-white/40">
                  Leo will guide you through a few short steps — no long forms, just what we need to power your
                  timetables.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={startNew}
                    className="bg-linear-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-900/20"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {confirmationDialog}
      <div className="space-y-4">
        <Card className="border border-white/10 bg-slate-950/80">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Your daily schedule</h3>
                <p className="text-xs text-white/50">
                  Revision {row.revision ?? 0} · Last updated:{" "}
                  {row.updatedAt
                    ? new Date(row.updatedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-white/10 bg-white/5 text-white"
                  onClick={startEdit}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={handleDelete}
                  disabled={del.isPending}
                >
                  {del.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
            <div className="mb-4">
              <DayTimelineStrip config={row.config} gradeOptions={grades} />
            </div>
            <ConfigSummaryView config={row.config} gradeNames={gradeNames} />
            {row.history && row.history.length > 0 && (
              <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-slate-950/40 p-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-white">
                  <History className="h-4 w-4 text-violet-300" />
                  Recent changes (older snapshots)
                </h4>
                <p className="text-xs text-white/45">
                  Each save stores the previous config so you can see what was active before. Labels help tie a
                  version to a term or week.
                </p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-white/65">
                  {row.history
                    .slice()
                    .reverse()
                    .map((h) => (
                      <li
                        key={`${h.revision}-${h.savedAt ?? "x"}`}
                        className="flex flex-col gap-0.5 rounded border border-white/5 bg-white/5 px-2 py-1.5 sm:flex-row sm:items-baseline sm:justify-between"
                      >
                        <span>
                          <span className="text-violet-200">r{h.revision}</span>
                          {h.label ? ` — ${h.label}` : ""}
                        </span>
                        <span className="text-white/40">
                          {h.savedAt
                            ? new Date(h.savedAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="mt-4 rounded-lg border border-white/5 bg-white/5 p-3 text-xs text-white/45">
              <span className="text-white/60">At a glance — </span>
              {SAMPLE_DAYS.map((d) => {
                const p = effectivePeriodsFor(row.config, d, null);
                return (
                  <span key={d} className="mr-2 inline-block capitalize">
                    {d.slice(0, 3)}: ~{p.fullPeriods} periods
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
