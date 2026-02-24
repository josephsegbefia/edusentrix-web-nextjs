"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  BookOpen,
  GraduationCap,
  Globe,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Layers,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  X,
  Info,
  FileWarning,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

const ASSESSMENT_MODEL_LABELS: Record<string, string> = {
  ca_exam: "CA + Exam",
  criteria_rubric: "Criteria Rubric",
  standards_based: "Standards-Based",
  portfolio: "Portfolio",
  points_average: "Points Average",
  custom: "Custom",
};

const GRADING_LABELS: Record<string, string> = {
  letter_af: "Letter Grades (A\u2013F)",
  ib_1_7: "IB Levels (1\u20137)",
  cambridge_ag: "Cambridge (A*\u2013G)",
  descriptive: "Descriptive",
  gpa_4: "GPA (4.0 Scale)",
  custom: "Custom",
};

const TERM_LABELS: Record<string, string> = {
  three_terms: "3 Terms",
  two_semesters: "2 Semesters",
  four_quarters: "4 Quarters",
  trimesters: "Trimesters",
};

type AcademicDataStatus = {
  hasAssessments: boolean;
  hasPublishedGrades: boolean;
  assessmentCount: number;
  publishedGradeCount: number;
  canSwitch: boolean;
};

type PendingCurriculum = {
  code: string;
  label: string;
  effectiveDate: string | null;
} | null;

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function CurriculumSettingsPage() {
  const queryClient = useQueryClient();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [selectedCode, setSelectedCode] = React.useState<CurriculumCode | null>(
    null
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-curriculum"],
    queryFn: async () => {
      const res = await fetch("/api/admin/curriculum");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      curriculumCode: CurriculumCode;
      force?: boolean;
      scheduleForNextYear?: boolean;
    }) => {
      const res = await fetch("/api/admin/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || "Failed to update") as any;
        err.code = json.code;
        err.academicData = json.academicData;
        throw err;
      }
      return json;
    },
    onSuccess: (result) => {
      if (result.scheduled) {
        toast.success("Curriculum change scheduled for next academic year");
      } else {
        toast.success("Curriculum updated successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum"] });
    },
    onError: (err: any) => {
      if (err.code !== "ACADEMIC_DATA_EXISTS") {
        toast.error("Failed to update curriculum");
      }
    },
  });

  const cancelPendingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/curriculum", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Scheduled curriculum change cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum"] });
    },
    onError: () => {
      toast.error("Failed to cancel scheduled change");
    },
  });

  const curriculum = data?.data?.currentCurriculum;
  const available: any[] = data?.data?.availableCurricula || [];
  const academicData: AcademicDataStatus | null =
    data?.data?.academicData || null;
  const pendingCurriculum: PendingCurriculum =
    data?.data?.pendingCurriculum || null;

  React.useEffect(() => {
    if (curriculum?.code && !selectedCode) {
      setSelectedCode(curriculum.code);
    }
  }, [curriculum?.code, selectedCode]);

  const selectedInfo = available.find((c: any) => c.code === selectedCode);
  const isCurrentCurriculum = selectedCode === curriculum?.code;
  const canSwitchImmediately = academicData?.canSwitch ?? true;

  async function handleApply() {
    if (!selectedCode || isCurrentCurriculum) return;

    if (canSwitchImmediately) {
      const result = await confirm({
        title: "Change Curriculum?",
        description: `This will switch your school's curriculum from "${curriculum?.label}" to "${selectedInfo?.label}". This affects grading scales, assessment types, grade structures, and report templates for future academic work. Existing data will not be deleted.`,
        confirmLabel: "Apply Curriculum",
        cancelLabel: "Cancel",
        intent: "warning",
      });
      if (result !== "confirm") return;

      updateMutation.mutate({ curriculumCode: selectedCode });
    } else {
      const result = await confirm({
        title: "Academic Data Exists",
        description: `Your school has ${academicData!.assessmentCount.toLocaleString()} assessment(s) and ${academicData!.publishedGradeCount.toLocaleString()} published grade(s) recorded under the current curriculum. Switching now could cause inconsistencies in existing records. We recommend scheduling the change for the next academic year instead.`,
        confirmLabel: "Schedule for Next Year",
        cancelLabel: "Cancel",
        intent: "warning",
      });
      if (result !== "confirm") return;

      updateMutation.mutate({
        curriculumCode: selectedCode,
        scheduleForNextYear: true,
      });
    }
  }

  async function handleForceSwitch() {
    if (!selectedCode || isCurrentCurriculum) return;

    const result = await confirm({
      title: "Force Curriculum Change?",
      description: `This will immediately switch the curriculum despite having existing academic data (${academicData!.assessmentCount.toLocaleString()} assessments, ${academicData!.publishedGradeCount.toLocaleString()} grades). Previous records will remain unchanged but may be calculated under a different grading system than the new curriculum. This action cannot be undone. Only proceed if you fully understand the implications.`,
      confirmLabel: "Force Switch",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (result !== "confirm") return;

    updateMutation.mutate({
      curriculumCode: selectedCode,
      force: true,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmationDialog}

      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-white">
          Curriculum Configuration
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Choose and configure the academic curriculum your school follows
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent backdrop-blur">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20">
              <BookOpen className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs text-white/50">Current Curriculum</p>
              <p className="text-sm font-semibold text-white">
                {curriculum?.label || "Not set"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-blue-500/10 to-transparent backdrop-blur">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-blue-500/20">
              <GraduationCap className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <p className="text-xs text-white/50">Assessment Model</p>
              <p className="text-sm font-semibold text-white">
                {ASSESSMENT_MODEL_LABELS[curriculum?.assessmentModel] || "\u2014"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-violet-500/10 to-transparent backdrop-blur">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20">
              <Globe className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <p className="text-xs text-white/50">Grading System</p>
              <p className="text-sm font-semibold text-white">
                {GRADING_LABELS[curriculum?.gradingSystem] || "\u2014"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending curriculum banner */}
      {pendingCurriculum && (
        <Card className="border border-amber-500/20 bg-amber-500/5 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                <CalendarClock className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Curriculum Change Scheduled
                </p>
                <p className="text-xs text-white/60">
                  <strong className="text-white/80">
                    {pendingCurriculum.label}
                  </strong>{" "}
                  will take effect at the start of the next academic year.
                  Existing data under the current curriculum will remain
                  unchanged.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelPendingMutation.mutate()}
              disabled={cancelPendingMutation.isPending}
              className="shrink-0 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
            >
              {cancelPendingMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <span className="ml-1">Cancel</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Academic data warning */}
      {!canSwitchImmediately && (
        <Card className="border border-white/10 bg-linear-to-br from-rose-500/5 to-transparent backdrop-blur">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 mt-0.5">
              <ShieldAlert className="h-4 w-4 text-rose-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Immediate Switch Restricted
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                Your school has{" "}
                <strong className="text-white/80">
                  {academicData!.assessmentCount.toLocaleString()} assessment(s)
                </strong>{" "}
                and{" "}
                <strong className="text-white/80">
                  {academicData!.publishedGradeCount.toLocaleString()} published
                  grade(s)
                </strong>{" "}
                under the current curriculum. You can schedule a curriculum
                change for the next academic year, or force an immediate switch
                if necessary.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Curriculum Card */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-brand" />
            Change Curriculum
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Select curriculum
            </label>
            <PremiumSelect
              value={selectedCode || ""}
              onValueChange={(v) => setSelectedCode(v as CurriculumCode)}
            >
              <PremiumSelectTrigger
                icon={<Globe className="h-4 w-4" />}
                className="h-11"
              >
                <PremiumSelectValue placeholder="Choose a curriculum" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {available.map((c: any) => (
                  <PremiumSelectItem
                    key={c.code}
                    value={c.code}
                    description={c.description}
                  >
                    {c.label}
                    {c.code === curriculum?.code && (
                      <span className="ml-2 text-[10px] text-emerald-400 font-medium">
                        (current)
                      </span>
                    )}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          {selectedInfo && !isCurrentCurriculum && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                <p className="text-sm text-white/80">
                  {selectedInfo.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Badge
                  variant="outline"
                  className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs justify-center"
                >
                  {ASSESSMENT_MODEL_LABELS[selectedInfo.assessmentModel]}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-blue-500/25 bg-blue-500/10 text-blue-300 text-xs justify-center"
                >
                  {GRADING_LABELS[selectedInfo.gradingSystem]}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-violet-500/25 bg-violet-500/10 text-violet-300 text-xs justify-center"
                >
                  {TERM_LABELS[selectedInfo.termStructure]}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-500/25 bg-amber-500/10 text-amber-300 text-xs justify-center"
                >
                  {selectedInfo.gradeCount} grades \u00b7{" "}
                  {selectedInfo.subjectCount} subjects
                </Badge>
              </div>

              {/* What changes */}
              {!isCurrentCurriculum && (
                <div className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white/70">
                      What will change
                    </span>
                  </div>
                  <ul className="text-xs text-white/50 space-y-1 ml-6 list-disc">
                    <li>
                      Assessment model:{" "}
                      <span className="text-white/70">
                        {ASSESSMENT_MODEL_LABELS[curriculum?.assessmentModel]}{" "}
                        \u2192{" "}
                        {ASSESSMENT_MODEL_LABELS[selectedInfo.assessmentModel]}
                      </span>
                    </li>
                    <li>
                      Grading system:{" "}
                      <span className="text-white/70">
                        {GRADING_LABELS[curriculum?.gradingSystem]} \u2192{" "}
                        {GRADING_LABELS[selectedInfo.gradingSystem]}
                      </span>
                    </li>
                    <li>
                      Term structure:{" "}
                      <span className="text-white/70">
                        {TERM_LABELS[curriculum?.termStructure]} \u2192{" "}
                        {TERM_LABELS[selectedInfo.termStructure]}
                      </span>
                    </li>
                    <li>
                      Grade templates and subject suggestions will update
                    </li>
                  </ul>
                </div>
              )}

              {selectedCode === "hybrid" && (
                <div className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm text-white/80">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-brand" />
                    <span className="font-semibold">Hybrid Mode</span>
                  </div>
                  <p>
                    You can mix and match grade levels and subjects from any
                    curriculum. After selecting hybrid, use the grade and subject
                    setup pages to cherry-pick from Cambridge, IB, American,
                    British, and Ghana curricula.
                  </p>
                </div>
              )}
            </div>
          )}

          {isCurrentCurriculum && selectedCode && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-white/70">
                This is your school&apos;s current curriculum. Select a
                different one to make changes.
              </p>
            </div>
          )}

          {!isCurrentCurriculum && selectedCode && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/5 pt-4">
              {!canSwitchImmediately && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleForceSwitch}
                  disabled={updateMutation.isPending}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  <AlertTriangle className="h-4 w-4 mr-1.5" />
                  Force Immediate Switch
                </Button>
              )}
              <Button
                onClick={handleApply}
                disabled={updateMutation.isPending}
                className="bg-brand text-black hover:bg-brand/90"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : canSwitchImmediately ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : (
                  <CalendarClock className="h-4 w-4 mr-2" />
                )}
                {canSwitchImmediately
                  ? "Apply Curriculum"
                  : "Schedule for Next Year"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Configuration */}
      {curriculum && (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">
                Grade Levels ({curriculum.grades?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-2">
                {(curriculum.grades || []).map((g: any) => (
                  <Badge
                    key={g.code}
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white/70 text-xs"
                  >
                    {g.name}{" "}
                    <span className="text-white/30 ml-1">({g.stage})</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">
                Subjects ({curriculum.subjects?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-2">
                {(curriculum.subjects || []).map((s: any) => (
                  <Badge
                    key={s.name}
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white/70 text-xs"
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>

            {curriculum.gradingPreset && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">
                  Grading Scale
                </h4>
                <div className="flex flex-wrap gap-2">
                  {curriculum.gradingPreset.gradeMappings.map(
                    (m: any, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white/70 text-xs"
                      >
                        {m.letter} ({m.minPercentage}\u2013{m.maxPercentage}%)
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
