"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles, Plus, ChevronLeft, ChevronRight, Check, FileText } from "lucide-react";
import {
  useTeacherCoverageSummary,
  useTeacherCurricula,
  useTeacherCurriculumSubjects,
  useTeacherLeoSchemePlan,
  useTeacherSchemeCurriculumPatch,
  useTeacherSchemeDetail,
  useTeacherSchemeItemCoverageUpdate,
  useTeacherSchemeItemCreate,
  useTeacherSchemeItems,
  useTeacherSchemeItemsBatch,
  useTeacherSchemeSubmit,
} from "@/hooks/teacher/useTeacherSchemes";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import type { SchemeItemCoverageStatus, SchemeStatus } from "@/types/schemes";
import type { LeoSchemePlanMode, LeoSchemePlanResult } from "@/types/scheme-leo";
import { curriculumProgrammeLabel } from "@/lib/curricula/programme-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { SchemeStatusBadge } from "@/components/schemes/SchemeStatusBadge";
import { cn } from "@/lib/utils";
import {
  TEACHER_SCHEME_WIZARD_STEPS,
  type TeacherSchemeWizardStepId,
} from "./teacher-scheme-wizard-types";

const LEO_MODE_OPTIONS: { value: LeoSchemePlanMode; label: string }[] = [
  { value: "draft_from_curriculum", label: "Draft Scheme of Learning from curriculum" },
  { value: "missing_objectives", label: "Suggest missing objectives" },
  { value: "pacing", label: "Pacing review" },
  { value: "uncovered", label: "Uncovered curriculum topics" },
  { value: "catch_up", label: "Catch-up plan" },
  { value: "revision", label: "Revision / spiral plan" },
];

const COVERAGE_OPTIONS: { value: SchemeItemCoverageStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "covered", label: "Covered" },
  { value: "skipped", label: "Skipped" },
  { value: "moved", label: "Moved" },
  { value: "needs_review", label: "Needs review" },
];

type WizardShellProps = {
  schemeId: string;
};

export function TeacherSchemeWizard({ schemeId }: WizardShellProps) {
  const [itemTitle, setItemTitle] = React.useState("");
  const [itemObjective, setItemObjective] = React.useState("");
  const [plannedStartDate, setPlannedStartDate] = React.useState<Date | null>(null);
  const [plannedEndDate, setPlannedEndDate] = React.useState<Date | null>(null);
  const [curriculumId, setCurriculumId] = React.useState("");
  const [curriculumSubjectId, setCurriculumSubjectId] = React.useState("");
  const [leoMode, setLeoMode] = React.useState<LeoSchemePlanMode>("missing_objectives");
  const [nodeSearch, setNodeSearch] = React.useState("");
  const [leoResult, setLeoResult] = React.useState<LeoSchemePlanResult | null>(null);
  const [currentStep, setCurrentStep] = React.useState<TeacherSchemeWizardStepId>("overview");
  const [completedSteps, setCompletedSteps] = React.useState<Set<TeacherSchemeWizardStepId>>(
    () => new Set()
  );

  const { data: ctxRes } = useTeacherContext();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const teacherId = ctxRes?.data?.teacher?._id ?? "";
  const canPatchCoverage = can(permissions, PERMISSIONS.schemeItemUpdateCoverage);
  const isAdminUser = can(permissions, PERMISSIONS.schemeOfWorkApprove);
  const canBrowseCurriculum = can(permissions, PERMISSIONS.curriculumFrameworkRead);
  const ap = ctxRes?.data?.academicPlanning;
  const schemeOfWorkEnabled = ap?.enableSchemeOfWork ?? false;
  const aiSchemeDraftingEnabled = ap?.allowAiSchemeDrafting ?? false;
  const leoPlannerAllowed = schemeOfWorkEnabled && aiSchemeDraftingEnabled;
  const canOpenAdminSettings = can(permissions, PERMISSIONS.schemeOfWorkApprove);

  const { data: scheme, isLoading: schemeLoading, error: schemeError } =
    useTeacherSchemeDetail(schemeId || null);
  const { data: items, isLoading: itemsLoading, error: itemsError } = useTeacherSchemeItems(
    schemeId || null
  );
  const { data: coverageBundle, error: coverageError } = useTeacherCoverageSummary(schemeId || null);
  const itemCreate = useTeacherSchemeItemCreate(schemeId);
  const submitMutation = useTeacherSchemeSubmit();
  const coverageMutation = useTeacherSchemeItemCoverageUpdate(schemeId || null);
  const curriculumPatch = useTeacherSchemeCurriculumPatch(schemeId || null);
  const { data: curriculumBundle } = useTeacherCurricula(canBrowseCurriculum);
  const curricula = curriculumBundle?.curricula ?? [];
  const schoolProgrammeCode = curriculumBundle?.schoolCurriculumCode ?? null;
  const { data: curriculumSubjects = [] } = useTeacherCurriculumSubjects(
    curriculumId || null,
    canBrowseCurriculum
  );
  const leoPlan = useTeacherLeoSchemePlan(schemeId || null);
  const batchItems = useTeacherSchemeItemsBatch(schemeId || null);

  React.useEffect(() => {
    if (!scheme) return;
    setCurriculumId(scheme.curriculumId ?? "");
    setCurriculumSubjectId(scheme.curriculumSubjectId ?? "");
  }, [scheme?.id, scheme?.curriculumId, scheme?.curriculumSubjectId]);

  const summary = coverageBundle?.summary;
  const canEditCoverage =
    Boolean(scheme) &&
    canPatchCoverage &&
    (scheme!.status === "approved" || scheme!.status === "active") &&
    (isAdminUser || !scheme!.ownerTeacherId || scheme!.ownerTeacherId === teacherId);
  const canEditScheme = Boolean(scheme) && (scheme!.status === "draft" || scheme!.status === "needs_revision");

  const stepIds = TEACHER_SCHEME_WIZARD_STEPS.map((s) => s.id);
  const currentStepIndex = stepIds.indexOf(currentStep);

  const goToStep = (step: TeacherSchemeWizardStepId) => setCurrentStep(step);

  const goNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepIds.length) {
      setCurrentStep(stepIds[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepIds[prevIndex]);
    }
  };

  async function createItem() {
    const trimmed = itemTitle.trim();
    if (!trimmed) return;
    try {
      await itemCreate.mutateAsync({
        title: trimmed,
        topic: trimmed,
        learningObjective: itemObjective.trim() || null,
        learningObjectives: itemObjective.trim() ? [itemObjective.trim()] : [],
        plannedStartDate: plannedStartDate ? plannedStartDate.toISOString() : null,
        plannedEndDate: plannedEndDate ? plannedEndDate.toISOString() : null,
      });
      setItemTitle("");
      setItemObjective("");
      setPlannedStartDate(null);
      setPlannedEndDate(null);
    } catch {
      /* surfaced via itemCreate.error */
    }
  }

  async function submitScheme() {
    if (!schemeId) return;
    try {
      await submitMutation.mutateAsync(schemeId);
    } catch {
      /* surfaced via submitMutation.error */
    }
  }

  async function saveCurriculumLink() {
    try {
      await curriculumPatch.mutateAsync({
        curriculumId: curriculumId.trim() ? curriculumId.trim() : null,
        curriculumSubjectId: curriculumSubjectId.trim() ? curriculumSubjectId.trim() : null,
      });
    } catch {
      /* surfaced via curriculumPatch.error */
    }
  }

  async function runLeo() {
    try {
      const plan = await leoPlan.mutateAsync({
        mode: leoMode,
        ...(nodeSearch.trim() ? { nodeSearch: nodeSearch.trim() } : {}),
      });
      setLeoResult(plan);
    } catch {
      /* surfaced via leoPlan.error */
    }
  }

  async function applyLeoRows() {
    if (!leoResult?.suggestedRows?.length) return;
    try {
      await batchItems.mutateAsync(
        leoResult.suggestedRows.map((r) => ({
          weekNumber: r.weekNumber,
          title: r.title,
          learningObjective: r.learningObjective,
          notes: r.notes,
          curriculumNodeIds: r.curriculumNodeIds,
        }))
      );
    } catch {
      /* surfaced via batchItems.error */
    }
  }

  const loadError = schemeError?.message || itemsError?.message;
  const selectedCurriculumLabel = curricula.find((c) => c.id === scheme?.curriculumId);
  const selectedSubjectLabel = curriculumSubjects.find((s) => s.id === scheme?.curriculumSubjectId);

  const renderStepContent = () => {
    switch (currentStep) {
      case "overview":
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">This Scheme of Learning</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-white">
                  {schemeLoading ? "Loading…" : scheme?.title ?? "Scheme of Learning"}
                </h2>
                {scheme ? <SchemeStatusBadge status={scheme.status} /> : null}
              </div>
            </div>
            {scheme ? (
              <StatusNarrative schemeStatus={scheme.status} canEditScheme={canEditScheme} />
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/teacher/schemes"
                className="text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                ← All Schemes of Learning
              </Link>
              <span className="text-white/25">·</span>
              <Link
                href="/teacher/coverage"
                className="text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                Coverage dashboard
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-medium text-white">Submit for review</p>
              <p className="mt-1 text-sm text-white/60">
                When your weekly plan is ready, send it to your school admin for approval. You can still
                edit while the Scheme of Learning is in draft or needs revision.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={submitScheme}
                  disabled={
                    submitMutation.isPending ||
                    !scheme ||
                    !["draft", "needs_revision", "rejected"].includes(scheme.status)
                  }
                  className="bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  <Send className="h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit for review"}
                </Button>
              </div>
              {submitMutation.error ? (
                <p className="mt-2 text-sm text-rose-300">
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : "Submit failed"}
                </p>
              ) : null}
            </div>
          </div>
        );
      case "curriculum":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Curriculum alignment</h2>
              <p className="mt-1 text-sm text-white/65">
                Connect this Scheme of Learning to an active learning structure so suggestions and coverage line up
                with your school’s strands.
              </p>
            </div>
            {canBrowseCurriculum && canEditScheme ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-sm text-white/65">
                  Link the learning structure derived from an approved Scheme of Learning so Leo can align
                  draft rows with strands and lesson note outcomes. These structures are managed through{" "}
                  <strong className="text-white/85">Admin → Academics → Schemes of Learning</strong> —
                  separate from the school&apos;s programme setting (
                  <strong className="text-white/85">Curriculum</strong>: NaCCA, Cambridge, …).
                </p>
                {schoolProgrammeCode ? (
                  <p className="mt-2 text-xs text-sky-200/90">
                    School programme: {curriculumProgrammeLabel(schoolProgrammeCode) || schoolProgrammeCode}.
                    Matching frameworks are listed first in the dropdown.
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                    <span className="text-[11px] uppercase tracking-wide text-white/45">Curriculum</span>
                    <PremiumSelect
                      value={curriculumId}
                      onValueChange={(value) => {
                        setCurriculumId(value === "none" ? "" : value);
                        setCurriculumSubjectId("");
                      }}
                    >
                      <PremiumSelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                        <PremiumSelectValue placeholder="None" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        <PremiumSelectItem value="none">None</PremiumSelectItem>
                        {curricula.map((c) => (
                          <PremiumSelectItem key={c.id} value={c.id}>
                            {c.title} ({c.code})
                            {c.matchesSchoolCurriculum ? " — matches school programme" : ""}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </label>
                  <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
                    <span className="text-[11px] uppercase tracking-wide text-white/45">
                      Curriculum subject
                    </span>
                    <PremiumSelect
                      value={curriculumSubjectId}
                      onValueChange={(value) => setCurriculumSubjectId(value === "none" ? "" : value)}
                      disabled={!curriculumId}
                    >
                      <PremiumSelectTrigger className="border-white/10 bg-white/[0.06] text-white disabled:opacity-50">
                        <PremiumSelectValue placeholder="None" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        <PremiumSelectItem value="none">None</PremiumSelectItem>
                        {curriculumSubjects.map((s) => (
                          <PremiumSelectItem key={s.id} value={s.id}>
                            {s.subjectName ?? s.subjectId}
                            {s.gradeName ? ` · ${s.gradeName}` : ""}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </label>
                  <Button
                    type="button"
                    onClick={saveCurriculumLink}
                    disabled={curriculumPatch.isPending}
                    className="bg-violet-600 text-white hover:bg-violet-500"
                  >
                    {curriculumPatch.isPending ? "Saving…" : "Save curriculum link"}
                  </Button>
                </div>
                {!curricula.length ? (
                  <p className="mt-2 text-xs text-amber-200/90">
                    No active learning structure yet. A school admin should import and approve a Scheme of
                    Learning under{" "}
                    <strong className="text-amber-100">Admin → Academics → Schemes of Learning</strong>.
                  </p>
                ) : null}
                {curriculumPatch.error ? (
                  <p className="mt-2 text-sm text-rose-300">
                    {curriculumPatch.error instanceof Error
                      ? curriculumPatch.error.message
                      : "Save failed"}
                  </p>
                ) : null}
              </div>
            ) : null}
            {canBrowseCurriculum && !canEditScheme && scheme ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white/75">
                <p className="font-medium text-white">Linked framework</p>
                <p className="mt-2">
                  Curriculum:{" "}
                  {selectedCurriculumLabel
                    ? `${selectedCurriculumLabel.title} (${selectedCurriculumLabel.code})`
                    : scheme.curriculumId
                      ? scheme.curriculumId
                      : "None"}
                </p>
                <p className="mt-1">
                  Subject strand:{" "}
                  {selectedSubjectLabel
                    ? `${selectedSubjectLabel.subjectName ?? selectedSubjectLabel.subjectId}${selectedSubjectLabel.gradeName ? ` · ${selectedSubjectLabel.gradeName}` : ""}`
                    : scheme.curriculumSubjectId
                      ? scheme.curriculumSubjectId
                      : "None"}
                </p>
                <p className="mt-3 text-xs text-white/50">
                  This Scheme of Learning is no longer editable. Contact an admin if the curriculum link must change.
                </p>
              </div>
            ) : null}
            {!canBrowseCurriculum ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
                You don’t have permission to browse curriculum frameworks, so linking must be done by
                someone with <strong className="text-amber-50">curriculum framework</strong> access, or an
                admin can adjust this Scheme of Learning for you.
              </p>
            ) : null}
          </div>
        );
      case "plan":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Weekly plan</h2>
              <p className="mt-1 text-sm text-white/65">
                Add one row per week or topic. Use the next step for Leo suggestions, then track coverage
                after approval.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-medium text-white">Add a row</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Input
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="Topic or weekly item title"
                  className="min-w-[240px] flex-1 border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-white/35 focus-visible:border-blue-300/45 focus-visible:ring-blue-400/20"
                />
                <Button
                  type="button"
                  onClick={createItem}
                  disabled={itemCreate.isPending || !canEditScheme}
                  className="bg-blue-500 text-white hover:bg-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  {itemCreate.isPending ? "Adding…" : "Add item"}
                </Button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <Textarea
                  value={itemObjective}
                  onChange={(event) => setItemObjective(event.target.value)}
                  placeholder="Learning objective (optional)"
                  className="min-h-11 border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-white/35 focus-visible:border-blue-300/45 focus-visible:ring-blue-400/20"
                />
                <CustomDatePicker
                  value={plannedStartDate}
                  onChange={setPlannedStartDate}
                  placeholder="Start date"
                  className="text-white"
                />
                <CustomDatePicker
                  value={plannedEndDate}
                  onChange={setPlannedEndDate}
                  placeholder="End date"
                  className="text-white"
                />
              </div>
              {itemCreate.error ? (
                <p className="mt-2 text-sm text-rose-300">
                  {itemCreate.error instanceof Error ? itemCreate.error.message : "Could not add item"}
                </p>
              ) : null}
              {scheme?.status === "draft" ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  Coverage status is managed on the last step after this Scheme of Learning is approved or active.
                </p>
              ) : null}
              {!canEditScheme ? (
                <p className="mt-2 text-xs text-white/45">
                  This Scheme of Learning is read-only. Add or change rows only while status is draft or needs revision.
                </p>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Planned rows</h3>
              {itemsLoading ? (
                <p className="mt-2 text-sm text-white/70">Loading items…</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {(items || []).length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-950/30 px-4 py-6 text-center text-sm text-white/55">
                      No rows yet. Add your first weekly item above.
                    </p>
                  ) : (
                    (items || []).map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-slate-950/30 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-medium text-white">{item.title}</h4>
                              <span className="text-xs text-white/60">Week {item.weekNumber ?? "—"}</span>
                            </div>
                            {item.learningObjective ? (
                              <p className="mt-1 text-sm text-white/70">{item.learningObjective}</p>
                            ) : null}
                            {item.lessonNoteCount ? (
                              <p className="mt-2 text-xs text-emerald-200">
                                {item.lessonNoteCount} lesson note{item.lessonNoteCount === 1 ? "" : "s"} linked
                              </p>
                            ) : null}
                          </div>
                          {scheme?.status === "approved" || scheme?.status === "active" ? (
                            <Button
                              type="button"
                              asChild
                              size="sm"
                              variant="outline"
                              className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                            >
                              <Link href={`/teacher/lesson-notes?createFromSchemeItem=${item.id}`}>
                                <FileText className="mr-2 h-4 w-4" />
                                Lesson note
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case "leo":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Leo academic planner</h2>
              <p className="mt-1 text-sm text-white/65">
                Optional AI-assisted drafts — always review before applying rows. The server needs{" "}
                <span className="text-white/85">OPENAI_API_KEY</span> when suggestions are generated.
              </p>
            </div>
            {!canEditScheme ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/75">
                Leo is available only while this Scheme of Learning is editable (draft or needs revision). Your current
                status is locked for structural edits.
              </p>
            ) : (
              <div className="rounded-xl border border-violet-500/25 bg-slate-950/50 p-4">
                {!schemeOfWorkEnabled ? (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
                    Scheme of Learning is turned off for your school. A school admin should enable it under{" "}
                    {canOpenAdminSettings ? (
                      <Link
                        href="/admin/settings?tab=features"
                        className="font-medium text-amber-50 underline underline-offset-2"
                      >
                        Admin → Settings → Features
                      </Link>
                    ) : (
                      <strong className="text-amber-50">Admin → Settings → Features</strong>
                    )}{" "}
                    (&quot;Enable Scheme of Learning&quot;).
                  </p>
                ) : null}
                {schemeOfWorkEnabled && !aiSchemeDraftingEnabled ? (
                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
                    AI-assisted Scheme of Learning drafting is off. A school admin can enable{" "}
                    <strong className="text-amber-50">AI-assisted Scheme of Learning drafting (Leo)</strong> under{" "}
                    {canOpenAdminSettings ? (
                      <Link
                        href="/admin/settings?tab=features"
                        className="font-medium text-amber-50 underline underline-offset-2"
                      >
                        Admin → Settings → Features
                      </Link>
                    ) : (
                      <strong className="text-amber-50">Admin → Settings → Features</strong>
                    )}
                    .
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
                    <span className="text-[11px] uppercase tracking-wide text-white/45">Mode</span>
                    <PremiumSelect
                      value={leoMode}
                      onValueChange={(value) => {
                        setLeoMode(value as LeoSchemePlanMode);
                        setLeoResult(null);
                      }}
                      disabled={!leoPlannerAllowed}
                    >
                      <PremiumSelectTrigger className="border-white/10 bg-white/[0.06] text-white disabled:opacity-50">
                        <PremiumSelectValue placeholder="Planner mode" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {LEO_MODE_OPTIONS.map((o) => (
                          <PremiumSelectItem key={o.value} value={o.value}>
                            {o.label}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </label>
                  <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
                    <span className="text-[11px] uppercase tracking-wide text-white/45">
                      Filter nodes (optional)
                    </span>
                    <Input
                      value={nodeSearch}
                      onChange={(e) => setNodeSearch(e.target.value)}
                      placeholder="Search curriculum nodes…"
                      disabled={!leoPlannerAllowed}
                      className="border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-white/35 focus-visible:border-violet-300/45 focus-visible:ring-violet-400/20 disabled:opacity-50"
                    />
                  </label>
                  <Button
                    type="button"
                    onClick={runLeo}
                    disabled={leoPlan.isPending || !leoPlannerAllowed}
                    className="bg-violet-500 text-white hover:bg-violet-400"
                  >
                    <Sparkles className="h-4 w-4" />
                    {leoPlan.isPending ? "Generating…" : "Generate draft"}
                  </Button>
                </div>
                {leoPlan.error ? (
                  <p className="mt-2 text-sm text-rose-300">
                    {leoPlan.error instanceof Error ? leoPlan.error.message : "Planner failed"}
                  </p>
                ) : null}
                {leoResult ? (
                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <p className="text-xs text-amber-200/90">{leoResult.disclaimer}</p>
                    <div className="whitespace-pre-wrap text-sm text-white/80">{leoResult.assistantSummary}</div>
                    {leoResult.pacingNotes ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/45">Pacing</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{leoResult.pacingNotes}</p>
                      </div>
                    ) : null}
                    {leoResult.uncoveredTopics.length ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/45">Uncovered topics</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-white/75">
                          {leoResult.uncoveredTopics.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {leoResult.revisionFocus.length ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/45">Revision focus</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-white/75">
                          {leoResult.revisionFocus.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {leoResult.catchUpNotes ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/45">Catch-up</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{leoResult.catchUpNotes}</p>
                      </div>
                    ) : null}
                    {leoResult.suggestedRows.length ? (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white">
                            Suggested rows ({leoResult.suggestedRows.length})
                          </p>
                          <Button
                            type="button"
                            onClick={applyLeoRows}
                            disabled={batchItems.isPending}
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                          >
                            {batchItems.isPending ? "Adding…" : "Add all as draft items"}
                          </Button>
                        </div>
                        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/10">
                          <table className="w-full text-left text-xs text-white/80">
                            <thead className="sticky top-0 bg-slate-950/95 text-[11px] uppercase tracking-wide text-white/45">
                              <tr>
                                <th className="px-2 py-2">Week</th>
                                <th className="px-2 py-2">Title</th>
                                <th className="px-2 py-2">Objective</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leoResult.suggestedRows.map((r, idx) => (
                                <tr key={`${r.title}-${idx}`} className="border-t border-white/5">
                                  <td className="px-2 py-2 align-top">{r.weekNumber ?? "—"}</td>
                                  <td className="px-2 py-2 align-top">{r.title}</td>
                                  <td className="px-2 py-2 align-top text-white/65">
                                    {r.learningObjective ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {batchItems.error ? (
                  <p className="mt-2 text-sm text-rose-300">
                    {batchItems.error instanceof Error ? batchItems.error.message : "Batch add failed"}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        );
      case "coverage":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Coverage</h2>
              <p className="mt-1 text-sm text-white/65">
                After approval, record how each planned row was delivered. This helps your coverage
                dashboard stay accurate.
              </p>
            </div>
            {scheme && scheme.status !== "approved" && scheme.status !== "active" ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
                Coverage tracking turns on when this Scheme of Learning is <strong className="text-amber-50">approved</strong>{" "}
                or <strong className="text-amber-50">active</strong>. Finish your plan and submit it from the
                Overview step first.
              </p>
            ) : null}
            {coverageError && scheme && (scheme.status === "approved" || scheme.status === "active") ? (
              <p className="text-sm text-amber-200/90">{coverageError.message}</p>
            ) : null}
            {summary && scheme && (scheme.status === "approved" || scheme.status === "active") ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Overview</h3>
                <p className="mt-1 text-sm text-white/65">
                  {summary.covered} of {summary.totalItems} planned rows marked covered (
                  {summary.coveragePercentage}%).
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width]"
                    style={{ width: `${summary.coveragePercentage}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                  <span>Not started: {summary.notStarted}</span>
                  <span>In progress: {summary.inProgress}</span>
                  <span>Skipped: {summary.skipped}</span>
                  <span>Moved: {summary.moved}</span>
                  <span>Needs review: {summary.needsReview}</span>
                </div>
              </div>
            ) : null}
            <div>
              <h3 className="text-sm font-medium text-white">Rows and coverage</h3>
              {itemsLoading ? (
                <p className="mt-2 text-sm text-white/70">Loading items…</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {(items || []).map((item) => (
                    <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-medium text-white">{item.title}</h4>
                            <span className="text-xs text-white/60">Week {item.weekNumber ?? "—"}</span>
                          </div>
                          {item.learningObjective ? (
                            <p className="mt-1 text-sm text-white/70">{item.learningObjective}</p>
                          ) : null}
                          {item.lessonNoteCount ? (
                            <p className="mt-2 text-xs text-emerald-200">
                              {item.lessonNoteCount} lesson note{item.lessonNoteCount === 1 ? "" : "s"} linked
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                        >
                          <Link href={`/teacher/lesson-notes?createFromSchemeItem=${item.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            Lesson note
                          </Link>
                        </Button>
                        {canEditCoverage && item.status !== "dropped" ? (
                          <div className="flex shrink-0 flex-col gap-1 sm:w-52">
                            <label className="text-[11px] uppercase tracking-wide text-white/45">
                              Coverage
                            </label>
                            <PremiumSelect
                              value={item.coverageStatus}
                              disabled={coverageMutation.isPending}
                              onValueChange={(value) => {
                                coverageMutation.mutate({
                                  itemId: item.id,
                                  status: value as SchemeItemCoverageStatus,
                                });
                              }}
                            >
                              <PremiumSelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                                <PremiumSelectValue placeholder="Coverage status" />
                              </PremiumSelectTrigger>
                              <PremiumSelectContent>
                                {COVERAGE_OPTIONS.map((o) => (
                                  <PremiumSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </PremiumSelectItem>
                                ))}
                              </PremiumSelectContent>
                            </PremiumSelect>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-white/50">
                            <span className="block text-[11px] uppercase tracking-wide text-white/45">
                              Coverage
                            </span>
                            <span className="text-sm text-white/75">
                              {COVERAGE_OPTIONS.find((o) => o.value === item.coverageStatus)?.label ??
                                item.coverageStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!schemeId) {
    return <p className="text-sm text-white/70">Invalid Scheme of Learning.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TEACHER_SCHEME_WIZARD_STEPS.map((step, index) => {
          const stepId = step.id;
          const isCompleted = completedSteps.has(stepId);
          const isCurrent = currentStep === stepId;
          const isPast = index < currentStepIndex;

          return (
            <React.Fragment key={stepId}>
              {index > 0 && (
                <div
                  className={cn(
                    "h-px w-6 sm:w-8 transition-colors",
                    isPast || isCompleted ? "bg-emerald-500" : "bg-white/10"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => goToStep(stepId)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : isCompleted || isPast
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {loadError ? <p className="text-center text-sm text-rose-300">{loadError}</p> : null}

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {schemeLoading ? (
                <p className="text-sm text-white/70">Loading Scheme of Learning…</p>
              ) : schemeError ? (
                <p className="text-sm text-rose-300">
                  {schemeError instanceof Error ? schemeError.message : "Failed to load Scheme of Learning"}
                </p>
              ) : (
                renderStepContent()
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {currentStepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              asChild
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <Link href="/teacher/schemes">
                <ChevronLeft className="mr-1 h-4 w-4" />
                All Schemes of Learning
              </Link>
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {currentStepIndex === stepIds.length - 1 ? (
            <Button
              type="button"
              asChild
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
            >
              <Link href="/teacher/schemes">
                Back to Schemes of Learning
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusNarrative({
  schemeStatus,
  canEditScheme,
}: {
  schemeStatus: SchemeStatus;
  canEditScheme: boolean;
}) {
  const lines: Record<string, string> = {
    draft:
      "You’re building this Scheme of Learning. Add weekly rows, optionally use Leo, then submit when you’re ready.",
    needs_revision:
      "An admin asked for changes. Update your plan and submit again when you’re ready.",
    rejected: "This submission was not accepted. Adjust your plan and submit again.",
    submitted: "Waiting for school admin review. You can’t change structure until you hear back.",
    approved:
      "Approved — use the Coverage step to record how each row was taught. Structural edits are locked.",
    active:
      "This Scheme of Learning is active. Keep coverage up to date so reporting stays accurate.",
    archived: "This Scheme of Learning is archived for reference only.",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
      <p>{lines[schemeStatus] ?? "Review this Scheme of Learning status with your admin if anything looks wrong."}</p>
      {canEditScheme ? (
        <p className="mt-2 text-xs text-white/50">
          Steps <strong className="text-white/70">Curriculum</strong> through{" "}
          <strong className="text-white/70">Leo</strong> apply while you can still edit the plan.
        </p>
      ) : (
        <p className="mt-2 text-xs text-white/50">
          Focus on the <strong className="text-white/70">Coverage</strong> step to update teaching status.
        </p>
      )}
    </div>
  );
}
