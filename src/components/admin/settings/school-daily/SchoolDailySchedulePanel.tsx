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
  type SaveSchoolDailyScheduleInput,
} from "@/hooks/admin/useSchoolDailySchedule";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  SchoolDailyScheduleMasterWizard,
  type MasterSeed,
} from "./SchoolDailyScheduleMasterWizard";
import { ConfigSummaryView } from "./SchoolDailyConfigSummaryView";
import { DayTimelineStrip } from "./DayTimelineStrip";
import { Badge } from "@/components/ui/badge";
import { effectivePeriodsFor } from "@/lib/school-day/periods";
import type { WeekdayKey } from "@/types/school-daily-schedule";
import { Pencil, Trash2, Loader2, Sparkles, History, Clock3, GraduationCap, Settings2 } from "lucide-react";
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

export function SchoolDailySchedulePanel() {
  const { data: school } = useSchool();
  const { data: row, isLoading, isError, refetch } = useSchoolDailySchedule();
  const { data: grades = [] } = useGradeOptions();
  const save = useSaveSchoolDailySchedule();
  const del = useDeleteSchoolDailySchedule();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const [masterOpen, setMasterOpen] = React.useState(false);
  const [masterSeed, setMasterSeed] = React.useState<MasterSeed>({ kind: "empty" });
  const [wizardKey, setWizardKey] = React.useState(0);

  const schoolName = school?.data?.name || "your school";
  const gradeNames = React.useCallback(
    (id: string) => grades.find((g) => g._id === id)?.name || "",
    [grades]
  );

  const seedFromRow = React.useCallback((): MasterSeed => {
    if (!row) return { kind: "empty" };
    if (row.scheduleMode === "grouped" && row.scheduleGroups?.length) {
      return {
        kind: "grouped",
        groups: row.scheduleGroups.map((g) => ({
          id: g.id,
          label: g.label,
          gradeIds: [...g.gradeIds],
          classGroupIds: [...(g.classGroupIds ?? [])],
          config: g.config,
        })),
      };
    }
    if (row.config) return { kind: "unified", config: row.config };
    return { kind: "empty" };
  }, [row]);

  const groupsDtoFromRow = React.useCallback(() => {
    if (!row?.scheduleGroups?.length) return [];
    return row.scheduleGroups.map((g) => ({
      id: g.id,
      label: g.label,
      gradeIds: [...g.gradeIds],
      classGroupIds: [...(g.classGroupIds ?? [])],
      config: g.config,
    }));
  }, [row]);

  const openMaster = (seed: MasterSeed) => {
    setMasterSeed(seed);
    setWizardKey((k) => k + 1);
    setMasterOpen(true);
  };

  const startNew = () => {
    openMaster({ kind: "empty" });
  };

  const startFullSetup = async () => {
    if (!row) return;
    const canEdit =
      (row.scheduleMode === "grouped" && (row.scheduleGroups?.length ?? 0) > 0) ||
      (row.scheduleMode === "unified" && !!row.config);
    if (!canEdit) return;

    const res = await confirm({
      title: "Edit entire daily schedule setup?",
      description:
        "You’ll step through scope, groups (if needed), and every band’s day template. Use this when restructuring grade groups or switching between school-wide and grouped mode. To tweak one band only, use Edit on that band’s card.",
      confirmLabel: "Continue",
      cancelLabel: "Back",
      intent: "warning",
    });
    if (res !== "confirm") return;
    openMaster(seedFromRow());
  };

  const startEditUnified = async () => {
    if (!row?.config) return;
    const res = await confirm({
      title: "Edit school-wide daily schedule?",
      description:
        "Changes update bell times, breaks, and period count for all grades using this schedule. Class timetables will use the new limits — review drafts afterward.",
      confirmLabel: "Continue",
      cancelLabel: "Back",
      intent: "warning",
    });
    if (res !== "confirm") return;
    openMaster({ kind: "unified", config: row.config });
  };

  const startEditGroup = async (groupId: string) => {
    if (!row?.scheduleGroups?.length) return;
    const res = await confirm({
      title: "Edit this band’s schedule?",
      description:
        "Only this grade group’s day template (times, periods, breaks) will change. Other bands stay the same until you save on the review step.",
      confirmLabel: "Continue",
      cancelLabel: "Back",
      intent: "warning",
    });
    if (res !== "confirm") return;
    openMaster({ kind: "grouped-partial", focusGroupId: groupId, groups: groupsDtoFromRow() });
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

  const handleDeleteGroup = async (groupId: string) => {
    if (!row?.scheduleGroups?.length) return;
    const list = row.scheduleGroups;
    const victim = list.find((g) => g.id === groupId);
    if (!victim) return;

    if (list.length <= 1) {
      const res = await confirm({
        title: "Delete the daily schedule?",
        description:
          "This removes your only schedule band and clears the school’s saved daily pattern. Class timetables will have nothing to align to until you set this up again.",
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
        /* toast */
      }
      return;
    }

    const mergeTarget = list.find((g) => g.id !== groupId);
    const targetLabel = mergeTarget?.label?.trim() || "another band";
    const movingGrades =
      victim.gradeIds.map((id) => gradeNames(id)).filter(Boolean).join(", ") || "these grades";

    const res = await confirm({
      title: `Remove “${victim.label?.trim() || "this band"}”?`,
      description:
        `The API requires every grade to belong to a schedule band. ${movingGrades} will follow “${targetLabel}” for bell times and periods (their old template will be discarded). If you want a different split, use “Full setup”.`,
      confirmLabel: "Remove band & merge grades",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (res !== "confirm" || !mergeTarget) return;

    const nextGroups = list
      .filter((g) => g.id !== groupId)
      .map((g) => {
        if (g.id !== mergeTarget.id) {
          return {
            id: g.id,
            label: g.label,
            gradeIds: [...g.gradeIds],
            classGroupIds: g.classGroupIds ?? [],
            config: g.config,
          };
        }
        const mergedGradeIds = [...g.gradeIds];
        for (const id of victim.gradeIds) {
          if (!mergedGradeIds.includes(id)) mergedGradeIds.push(id);
        }
        return {
          id: g.id,
          label: g.label,
          gradeIds: mergedGradeIds,
          classGroupIds: g.classGroupIds ?? [],
          config: g.config,
        };
      });

    const covered = new Set<string>();
    for (const g of nextGroups) for (const id of g.gradeIds) covered.add(id);
    for (const id of victim.gradeIds) {
      if (!covered.has(id)) {
        toast.error("Could not merge grades safely. Use Full setup.");
        return;
      }
    }

    try {
      await busy.promise(
        save.mutateAsync({
          scheduleMode: "grouped",
          scheduleGroups: nextGroups,
          changeLabel: `Removed band: ${victim.label?.trim() || groupId}`,
        }),
        {
          loading: "Updating…",
          success: "Schedule band removed.",
          error: (e: Error) => e.message,
        }
      );
      void refetch();
    } catch {
      /* busy toast */
    }
  };

  const handleMasterSave = async (payload: SaveSchoolDailyScheduleInput) => {
    try {
      const out = await busy.promise(save.mutateAsync(payload), {
        loading: "Saving…",
        success: "Daily schedule saved.",
        error: (e: Error) => e.message,
      });
      if (out.warnings?.length) {
        for (const w of out.warnings) {
          toast.message("Schedule note", { description: w });
        }
      }
      setMasterOpen(false);
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

  if (masterOpen) {
    return (
      <>
        {confirmationDialog}
        <SchoolDailyScheduleMasterWizard
          key={wizardKey}
          seed={masterSeed}
          gradeOptions={grades}
          saving={save.isPending}
          onCancel={() => setMasterOpen(false)}
          onSave={handleMasterSave}
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

  const isGrouped = row.scheduleMode === "grouped";
  const previewStripConfig =
    isGrouped && row.scheduleGroups?.[0]?.config
      ? row.scheduleGroups[0].config
      : row.config;

  const scheduleCards =
    isGrouped && row.scheduleGroups?.length
      ? row.scheduleGroups.map((g, index) => {
          const gradesLabel =
            g.gradeIds.map((id) => gradeNames(id)).filter(Boolean).join(", ") ||
            "No grades assigned";
          const label = g.label?.trim() || `Schedule ${index + 1}`;
          const mondayPeriods = effectivePeriodsFor(g.config, "monday", null);
          return {
            id: g.id,
            label,
            gradesLabel,
            config: g.config,
            meta: `${formatHhmm12(g.config.lessonStart)} - ${formatHhmm12(
              g.config.dayEnd
            )} · ${mondayPeriods.fullPeriods} periods · ${g.config.periodLengthMinutes} min base`,
          };
        })
      : row.config
        ? [
            {
              id: row.id,
              label: "School-wide schedule",
              gradesLabel: "All active grades",
              config: row.config,
              meta: `${formatHhmm12(row.config.lessonStart)} - ${formatHhmm12(
                row.config.dayEnd
              )} · ${
                effectivePeriodsFor(row.config, "monday", null).fullPeriods
              } periods · ${row.config.periodLengthMinutes} min base`,
            },
          ]
        : [];

  return (
    <>
      {confirmationDialog}
      <div className="space-y-4">
        <Card className="border border-white/10 bg-slate-950/80">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Your daily schedule</h3>
                  {isGrouped ? (
                    <Badge
                      variant="secondary"
                      className="border border-violet-400/30 bg-violet-500/15 text-[11px] font-medium text-violet-100"
                    >
                      By grade group
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="border border-white/15 bg-white/10 text-[11px] font-medium text-white/80"
                    >
                      School-wide
                    </Badge>
                  )}
                </div>
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
                  size="sm"
                  className="border border-white/10 bg-white/5 text-white"
                  onClick={() => void startFullSetup()}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Full setup
                </Button>
              </div>
            </div>
            {isGrouped && (!row.scheduleGroups || row.scheduleGroups.length === 0) ? (
              <p className="mb-4 text-sm text-amber-200/90">
                Grouped schedules are enabled, but no bands were loaded. Open Full setup and save again; if this
                message persists, contact support.
              </p>
            ) : null}
            {scheduleCards.length > 0 ? (
              <div className="mb-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/40">Saved schedules</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{scheduleCards.length}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {isGrouped
                      ? "Every schedule group saved for this school."
                      : "The one schedule used by all grades."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/40">Mode</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {isGrouped ? "Different grade groups" : "School-wide"}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Timetable generation picks the matching schedule for each class grade.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/40">Revision</p>
                  <p className="mt-2 text-lg font-semibold text-white">r{row.revision ?? 0}</p>
                  <p className="mt-1 text-xs text-white/45">
                    Last updated{" "}
                    {row.updatedAt
                      ? new Date(row.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : "—"}
                  </p>
                </div>
              </div>
            ) : null}
            {scheduleCards.length > 0 ? (
              <div className="mb-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-white">All created daily schedules</h4>
                  <span className="text-xs text-white/40">
                    {scheduleCards.length} schedule{scheduleCards.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {scheduleCards.map((schedule) => (
                    <div key={schedule.id} className="rounded-xl border border-white/10 bg-white/3 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{schedule.label}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                            <GraduationCap className="h-3.5 w-3.5 text-violet-300" />
                            <span>{schedule.gradesLabel}</span>
                          </p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
                          <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                          {schedule.meta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {previewStripConfig && !(isGrouped && row.scheduleGroups && row.scheduleGroups.length > 0) ? (
              <div className="mb-4 space-y-3">
                <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">School-wide day</p>
                    <p className="text-xs text-white/45">Edit or remove the single schedule used by all grades.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="border border-white/10 bg-white/5 text-white"
                      onClick={() => void startEditUnified()}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      onClick={() => void handleDelete()}
                      disabled={del.isPending}
                    >
                      {del.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
                <DayTimelineStrip config={previewStripConfig} gradeOptions={grades} />
              </div>
            ) : isGrouped && row.scheduleGroups && row.scheduleGroups.length > 0 ? (
              <p className="mb-4 text-xs text-white/45">
                Each grade group has its own day timeline and breakdown below.
              </p>
            ) : !previewStripConfig ? (
              <p className="mb-4 text-sm text-amber-200/90">
                No schedule configuration found — open Full setup to complete setup.
              </p>
            ) : null}
            {isGrouped && row.scheduleGroups ? (
              <div className="space-y-10">
                {row.scheduleGroups.map((g) => {
                  const gradesLabel =
                    g.gradeIds.map((id) => gradeNames(id)).filter(Boolean).join(", ") ||
                    "Grades in this group";
                  return (
                    <div key={g.id} className="space-y-4 rounded-xl border border-white/10 bg-white/2 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="text-base font-semibold text-white">
                            {g.label?.trim() || "Schedule group"}
                          </h4>
                          <p className="text-xs text-white/45">{gradesLabel}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="border border-white/10 bg-white/5 text-white"
                            onClick={() => void startEditGroup(g.id)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                            onClick={() => void handleDeleteGroup(g.id)}
                            disabled={del.isPending || save.isPending}
                          >
                            {del.isPending || save.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
                        <DayTimelineStrip config={g.config} gradeOptions={grades} />
                      </div>
                      <ConfigSummaryView config={g.config} gradeNames={gradeNames} />
                    </div>
                  );
                })}
              </div>
            ) : row.config ? (
              <ConfigSummaryView config={row.config} gradeNames={gradeNames} />
            ) : null}
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
              {isGrouped && row.scheduleGroups
                ? row.scheduleGroups.map((g) => (
                    <span key={g.id} className="mr-3 inline-block">
                      <span className="text-white/55">
                        {(g.label?.trim() || "Group").slice(0, 24)}
                        {": "}
                      </span>
                      {SAMPLE_DAYS.map((d) => {
                        const p = effectivePeriodsFor(g.config, d, null);
                        return (
                          <span key={`${g.id}-${d}`} className="mr-2 inline-block capitalize">
                            {d.slice(0, 3)}: ~{p.fullPeriods}
                          </span>
                        );
                      })}
                    </span>
                  ))
                : previewStripConfig
                  ? SAMPLE_DAYS.map((d) => {
                      const p = effectivePeriodsFor(previewStripConfig, d, null);
                      return (
                        <span key={d} className="mr-2 inline-block capitalize">
                          {d.slice(0, 3)}: ~{p.fullPeriods} periods
                        </span>
                      );
                    })
                  : "—"}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
