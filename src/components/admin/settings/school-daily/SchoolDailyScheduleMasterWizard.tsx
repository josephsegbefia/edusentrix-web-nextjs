"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Link2,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createDefaultV2Config } from "@/lib/school-day/migrate-v2";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  SchoolDailyScheduleWizard,
  type SchoolDailySaveMeta,
} from "./SchoolDailyScheduleWizard";
import { ConfigSummaryView } from "./SchoolDailyConfigSummaryView";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";
import type {
  SaveSchoolDailyScheduleInput,
  SchoolDailyScheduleGroupDTO,
} from "@/hooks/admin/useSchoolDailySchedule";

function newGroupId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type StepId = "scope" | "groups" | "configure-unified" | "configure-group" | "review";

export type MasterSeed =
  | { kind: "empty" }
  | { kind: "unified"; config: SchoolDailyScheduleConfigV2 }
  | { kind: "grouped"; groups: SchoolDailyScheduleGroupDTO[] }
  /** Edit one band’s day template; other groups stay unchanged until you save at review */
  | { kind: "grouped-partial"; focusGroupId: string; groups: SchoolDailyScheduleGroupDTO[] };

export type SchoolDailyScheduleMasterWizardProps = {
  gradeOptions: Array<{ _id: string; name: string }>;
  saving: boolean;
  seed: MasterSeed;
  onCancel: () => void;
  onSave: (
    payload: SaveSchoolDailyScheduleInput,
    meta: SchoolDailySaveMeta
  ) => void | Promise<void>;
};

function LeoTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
          <LeoIcon className="h-5 w-5 text-violet-200" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/90">{title}</p>
          <div className="text-sm leading-relaxed text-white/70">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SchoolDailyScheduleMasterWizard({
  gradeOptions,
  saving,
  seed,
  onCancel,
  onSave,
}: SchoolDailyScheduleMasterWizardProps) {
  const gradeName = React.useCallback(
    (id: string) => gradeOptions.find((g) => g._id === id)?.name || "",
    [gradeOptions]
  );

  const partialGroupedEdit = seed.kind === "grouped-partial";

  const [scope, setScope] = React.useState<"unified" | "grouped" | null>(() =>
    seed.kind === "unified"
      ? "unified"
      : seed.kind === "grouped" || seed.kind === "grouped-partial"
        ? "grouped"
        : null
  );

  const [groups, setGroups] = React.useState<
    Array<{
      id: string;
      label: string;
      gradeIds: string[];
      classGroupIds?: string[];
      config: SchoolDailyScheduleConfigV2 | null;
    }>
  >(() => {
    if (seed.kind === "grouped" || seed.kind === "grouped-partial") {
      return seed.groups.map((g) => ({
        id: g.id,
        label: g.label?.trim() || "",
        gradeIds: [...g.gradeIds],
        classGroupIds: [...(g.classGroupIds ?? [])],
        config: g.config,
      }));
    }
    if (seed.kind === "unified") {
      return [{ id: newGroupId(), label: "", gradeIds: [], config: seed.config }];
    }
    return [{ id: newGroupId(), label: "", gradeIds: [], config: null }];
  });

  const [step, setStep] = React.useState<StepId>(() => {
    if (seed.kind === "unified") return "configure-unified";
    if (seed.kind === "grouped-partial") return "configure-group";
    if (seed.kind === "grouped") return "review";
    return "scope";
  });

  const [groupIdx, setGroupIdx] = React.useState(() => {
    if (seed.kind === "grouped-partial") {
      const i = seed.groups.findIndex((g) => g.id === seed.focusGroupId);
      return Math.max(0, i);
    }
    return 0;
  });
  const [changeLabel, setChangeLabel] = React.useState("");
  const [academicPeriodId, setAcademicPeriodId] = React.useState("");
  const [leoCoach, setLeoCoach] = React.useState<string | null>(null);
  const [leoLoading, setLeoLoading] = React.useState(false);

  const runLeoCoach = async (context: "scope" | "groups") => {
    setLeoLoading(true);
    try {
      const res = await fetch("/api/admin/school-daily-schedule/leo-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          scope,
          gradeCount: gradeOptions.length,
          groupCount: groups.length,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const text = typeof json?.data?.text === "string" ? json.data.text : "";
      setLeoCoach(text || "If most grades share bell times, use one school-wide schedule. Otherwise, group grades and set a day template per band.");
    } catch {
      setLeoCoach("If older and younger learners start or finish at different times, grouped schedules keep timetables accurate for each band.");
    } finally {
      setLeoLoading(false);
    }
  };

  React.useEffect(() => {
    if (step === "configure-group" && scope === "grouped" && groups[groupIdx]?.config == null) {
      setGroups((prev) => {
        const next = [...prev];
        if (next[groupIdx] && next[groupIdx].config == null) {
          next[groupIdx] = { ...next[groupIdx], config: createDefaultV2Config() };
        }
        return next;
      });
    }
  }, [step, scope, groupIdx, groups]);

  const unassigned = React.useMemo(() => {
    const inGroup = new Set<string>();
    for (const g of groups) for (const id of g.gradeIds) inGroup.add(id);
    return gradeOptions.map((g) => g._id).filter((id) => !inGroup.has(id));
  }, [groups, gradeOptions]);

  const totalSteps = partialGroupedEdit
    ? 2
    : scope === "unified"
      ? 3
      : scope === "grouped"
        ? 4
        : 1;
  const stepNumber = (() => {
    if (partialGroupedEdit) {
      if (step === "configure-group") return 1;
      if (step === "review") return 2;
      return 1;
    }
    if (step === "scope") return 1;
    if (step === "groups") return 2;
    if (step === "configure-unified") return 2;
    if (step === "configure-group") return 3;
    return totalSteps;
  })();

  const canNextFromScope = scope != null;
  const canNextFromGroups =
    scope === "grouped" &&
    unassigned.length === 0 &&
    groups.length > 0 &&
    groups.every((g) => g.gradeIds.length > 0);

  const pickUnified = () => {
    setScope("unified");
    setGroups([{ id: newGroupId(), label: "", gradeIds: [], classGroupIds: [], config: null }]);
  };

  const pickGrouped = () => {
    setScope("grouped");
    setGroups([{ id: newGroupId(), label: "", gradeIds: [], classGroupIds: [], config: null }]);
  };

  const goNext = () => {
    if (step === "scope" && scope === "unified") setStep("configure-unified");
    else if (step === "scope" && scope === "grouped") setStep("groups");
    else if (step === "groups") {
      setGroupIdx(0);
      setStep("configure-group");
    } else if (step === "configure-unified") setStep("review");
    else if (step === "configure-group") setStep("review");
  };

  const goBack = () => {
    if (partialGroupedEdit) {
      if (step === "review") {
        setStep("configure-group");
        return;
      }
      if (step === "configure-group") {
        onCancel();
        return;
      }
    }
    if (step === "review") {
      if (scope === "unified") setStep("configure-unified");
      else if (scope === "grouped") setStep("configure-group");
    } else if (step === "configure-unified" || step === "groups") setStep("scope");
    else if (step === "configure-group") {
      setStep("groups");
      setGroupIdx(0);
    }
  };

  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      { id: newGroupId(), label: "", gradeIds: [], classGroupIds: [], config: null },
    ]);
  };

  const removeGroup = (i: number) => {
    setGroups((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  };

  const toggleGradeInGroup = (groupIndex: number, gradeId: string, checked: boolean) => {
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, gradeIds: [...g.gradeIds] }));
      for (let j = 0; j < next.length; j += 1) {
        next[j].gradeIds = next[j].gradeIds.filter((id) => id !== gradeId);
      }
      if (checked) {
        next[groupIndex].gradeIds.push(gradeId);
      }
      return next;
    });
  };

  const unifiedConfigForReview =
    groups[0]?.config ?? (seed.kind === "unified" ? seed.config : null);

  const finishReview = () => {
    const meta: SchoolDailySaveMeta = {
      changeLabel: changeLabel.trim() || undefined,
      academicPeriodId: academicPeriodId.trim() || undefined,
    };
    if (scope === "unified") {
      const cfg = unifiedConfigForReview;
      if (!cfg) return;
      const payload: SaveSchoolDailyScheduleInput = {
        scheduleMode: "unified",
        config: cfg,
        changeLabel: meta.changeLabel,
        academicPeriodId: meta.academicPeriodId,
      };
      void onSave(payload, meta);
      return;
    }
    if (scope === "grouped") {
      const scheduleGroups = groups.map((g) => ({
        id: g.id,
        label: g.label || null,
        gradeIds: g.gradeIds,
        classGroupIds: g.classGroupIds ?? [],
        config: g.config ?? createDefaultV2Config(),
      }));
      const payload: SaveSchoolDailyScheduleInput = {
        scheduleMode: "grouped",
        scheduleGroups,
        changeLabel: meta.changeLabel,
        academicPeriodId: meta.academicPeriodId,
      };
      void onSave(payload, meta);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-2 text-xs text-white/50">
        <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/70">
          Step {stepNumber} of {totalSteps}
        </span>
        {partialGroupedEdit ? (
          <p className="max-w-md text-center text-[11px] leading-relaxed text-white/45">
            You&apos;re editing one grade group&apos;s day. Other bands stay as they are until you confirm on the
            final step.
          </p>
        ) : null}
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step + String(groupIdx)}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {step === "scope" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Who shares this daily schedule?</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Timetables for each class use the schedule for that class&apos;s grade.
                    </p>
                  </div>
                  <LeoTip title="Leo">
                    If everyone uses the same bell times and periods, pick <strong>one school-wide schedule</strong>.
                    If creche, primary, and JHS run different days, use <strong>groups</strong> so each band stays
                    accurate.
                  </LeoTip>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={pickUnified}
                      className={cn(
                        "rounded-2xl border-2 p-5 text-left transition-all",
                        scope === "unified"
                          ? "border-indigo-400/70 bg-indigo-500/15 shadow-lg shadow-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <Users className="mb-3 h-8 w-8 text-indigo-300" />
                      <p className="font-semibold text-white">Same schedule for all grades</p>
                      <p className="mt-2 text-sm text-white/55">
                        One school day pattern for every grade. Use different grade bands above if parts of the
                        school run on a different bell schedule.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={pickGrouped}
                      className={cn(
                        "rounded-2xl border-2 p-5 text-left transition-all",
                        scope === "grouped"
                          ? "border-amber-400/70 bg-amber-500/15 shadow-lg shadow-amber-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <Layers className="mb-3 h-8 w-8 text-amber-300" />
                      <p className="font-semibold text-white">Different groups of grades</p>
                      <p className="mt-2 text-sm text-white/55">
                        Example: JHS 1–3 together, upper primary together. Each group gets its own day template.
                      </p>
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-violet-400/40 text-violet-100"
                      disabled={leoLoading}
                      onClick={() => runLeoCoach("scope")}
                    >
                      {leoLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Ask Leo
                    </Button>
                    {leoCoach && <p className="text-sm text-white/60">{leoCoach}</p>}
                  </div>
                </div>
              )}

              {step === "groups" && scope === "grouped" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Group grades that share a day</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Every active grade must belong to exactly one group. One grade alone is a valid group.
                    </p>
                  </div>
                  <LeoTip title="Leo">
                    Start with the band that differs most from the rest. Labels are only for your admins — what
                    matters is the times and periods per group.
                  </LeoTip>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={addGroup}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Add group
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={leoLoading}
                      className="border-violet-400/40"
                      onClick={() => runLeoCoach("groups")}
                    >
                      {leoLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Ask Leo
                    </Button>
                  </div>
                  {unassigned.length > 0 && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      <strong>{unassigned.length}</strong> grade{unassigned.length === 1 ? "" : "s"} not in any
                      group: {unassigned.map(gradeName).filter(Boolean).join(", ")}
                    </div>
                  )}
                  <div className="space-y-4">
                    {groups.map((g, gi) => (
                      <div key={g.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-white/70">Group label (optional)</Label>
                          {groups.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(gi)}>
                              Remove group
                            </Button>
                          )}
                        </div>
                        <Input
                          value={g.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGroups((prev) => prev.map((row, j) => (j === gi ? { ...row, label: v } : row)));
                          }}
                          placeholder="e.g. JHS, Upper primary"
                          className="mb-4 border-white/10 bg-slate-950/50 text-white"
                        />
                        <p className="mb-2 text-xs font-medium text-white/50">Grades in this group</p>
                        <div className="flex flex-wrap gap-2">
                          {gradeOptions.map((gr) => {
                            const checked = g.gradeIds.includes(gr._id);
                            return (
                              <label
                                key={gr._id}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                                  checked
                                    ? "border-indigo-400/50 bg-indigo-500/15 text-white"
                                    : "border-white/10 bg-black/20 text-white/70"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-white/30"
                                  checked={checked}
                                  onChange={(e) => toggleGradeInGroup(gi, gr._id, e.target.checked)}
                                />
                                {gr.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === "configure-unified" && scope === "unified" && (
                <SchoolDailyScheduleWizard
                  initial={
                    seed.kind === "unified"
                      ? seed.config
                      : groups[0]?.config ?? null
                  }
                  gradeOptions={gradeOptions}
                  saving={saving}
                  onCancel={onCancel}
                  onSave={(config) => {
                    setGroups([{ id: groups[0]?.id ?? newGroupId(), label: "", gradeIds: [], config }]);
                    setStep("review");
                  }}
                />
              )}

              {step === "configure-group" && scope === "grouped" && groups[groupIdx] && (
                <div className="space-y-4">
                  {!partialGroupedEdit ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {groups.map((g, i) => (
                        <Badge
                          key={g.id}
                          variant="outline"
                          className={cn(
                            "cursor-pointer border-white/15 px-3 py-1",
                            i === groupIdx ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100" : "text-white/50"
                          )}
                          onClick={() => setGroupIdx(i)}
                        >
                          {g.label?.trim() || `Group ${i + 1}`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90">
                        Editing: {groups[groupIdx].label?.trim() || `Group ${groupIdx + 1}`}
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        Grades:{" "}
                        <span className="font-medium text-white">
                          {groups[groupIdx].gradeIds.map(gradeName).filter(Boolean).join(", ") || "—"}
                        </span>
                      </p>
                    </div>
                  )}
                  {!partialGroupedEdit ? (
                    <p className="text-sm text-white/55">
                      Configure the school day for:{" "}
                      <span className="font-medium text-white">
                        {groups[groupIdx].gradeIds.map(gradeName).filter(Boolean).join(", ") || "—"}
                      </span>
                    </p>
                  ) : null}
                  <SchoolDailyScheduleWizard
                    key={groups[groupIdx].id + String(groupIdx)}
                    initial={groups[groupIdx].config ?? createDefaultV2Config()}
                    gradeOptions={gradeOptions}
                    saving={saving}
                    embedMode
                    finishButtonLabel={
                      partialGroupedEdit
                        ? "Save & continue to review"
                        : groupIdx < groups.length - 1
                          ? "Save & next group"
                          : "Save & continue to review"
                    }
                    onCancel={onCancel}
                    onSave={(config) => {
                      setGroups((prev) => {
                        const next = [...prev];
                        next[groupIdx] = { ...next[groupIdx], config };
                        return next;
                      });
                      if (partialGroupedEdit) {
                        setStep("review");
                        return;
                      }
                      if (groupIdx < groups.length - 1) {
                        setGroupIdx((i) => i + 1);
                      } else {
                        setStep("review");
                      }
                    }}
                  />
                </div>
              )}

              {step === "review" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">Review & save</h2>
                  {partialGroupedEdit ? (
                    <p className="text-sm text-white/55">
                      Check the updated band below. Your other schedule groups are unchanged and will be saved as they
                      are now.
                    </p>
                  ) : null}
                  {scope === "unified" && unifiedConfigForReview && (
                    <ConfigSummaryView config={unifiedConfigForReview} gradeNames={gradeName} />
                  )}
                  {scope === "grouped" &&
                    groups.map((g, i) => (
                      <div
                        key={g.id}
                        className={cn(
                          "space-y-3 rounded-xl border bg-white/5 p-4",
                          partialGroupedEdit && g.id === groups[groupIdx]?.id
                            ? "border-indigo-400/40 ring-1 ring-indigo-400/20"
                            : "border-white/10 opacity-80"
                        )}
                      >
                        <p className="font-medium text-indigo-200">
                          {g.label?.trim() || `Group ${i + 1}`}
                          {partialGroupedEdit && g.id === groups[groupIdx]?.id ? (
                            <Badge variant="outline" className="ml-2 border-indigo-400/40 text-[10px] text-indigo-100">
                              Updated
                            </Badge>
                          ) : partialGroupedEdit ? (
                            <Badge variant="outline" className="ml-2 border-white/15 text-[10px] text-white/45">
                              Unchanged
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-white/45">
                          Grades: {g.gradeIds.map(gradeName).filter(Boolean).join(", ")}
                        </p>
                        {g.config ? (
                          <ConfigSummaryView config={g.config} gradeNames={gradeName} />
                        ) : (
                          <p className="text-sm text-rose-300">Missing schedule — go back and complete each group.</p>
                        )}
                      </div>
                    ))}
                  <div className="space-y-2">
                    <Label className="text-white/60">Version note (optional)</Label>
                    <Input
                      value={changeLabel}
                      onChange={(e) => setChangeLabel(e.target.value)}
                      className="border-white/10 bg-slate-950/50 text-white"
                      placeholder="e.g. Term 2 — split JHS schedule"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Academic period ID (optional)</Label>
                    <Input
                      value={academicPeriodId}
                      onChange={(e) => setAcademicPeriodId(e.target.value)}
                      className="border-white/10 bg-slate-950/50 text-white"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {step !== "configure-unified" && step !== "configure-group" && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={step === "scope" ? onCancel : goBack}
            className="border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {step === "scope" ? "Cancel" : "Back"}
          </Button>
          {step === "scope" && (
            <Button type="button" disabled={!canNextFromScope} onClick={goNext}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "groups" && (
            <Button type="button" disabled={!canNextFromGroups} onClick={goNext}>
              Next — configure each day
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "review" && (
            <Button
              type="button"
              className="bg-linear-to-r from-violet-500 to-purple-600"
              disabled={saving || (scope === "grouped" && groups.some((g) => !g.config))}
              onClick={finishReview}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save to school"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
