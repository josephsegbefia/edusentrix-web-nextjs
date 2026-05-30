"use client";

import * as React from "react";
import { Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Switch } from "@/components/ui/switch";
import { useUpdateAssessmentItem } from "@/hooks/teacher/useTeacherAssessmentItems";
import { useBusyToast } from "@/hooks/useBusyToast";
import { CONTRIBUTION_MODE_LABELS } from "@/constants/academics/assessment-engine";
import {
  getComponentContributionModeExplanation,
  getItemContributionDisplay,
  humanizeAssessmentType,
} from "@/lib/academics/assessment-engine/assessment-item-rules";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

const STATUS_BADGE_STYLES = {
  included: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  excluded: "border-white/10 bg-white/5 text-white/50",
  locked: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
} as const;

type ReportContributionTabProps = {
  gradebook: TeacherGradebookV2DTO;
  classGroupId: string;
  subjectId: string;
  canRecord: boolean;
  onRefresh?: () => void;
};

export function ReportContributionTab({
  gradebook,
  classGroupId,
  subjectId,
  canRecord,
  onRefresh,
}: ReportContributionTabProps) {
  const busy = useBusyToast();
  const updateItem = useUpdateAssessmentItem();
  const [pendingItemId, setPendingItemId] = React.useState<string | null>(null);

  if (gradebook.componentSummary.length === 0) {
    return (
      <GlassPanel className="p-8 text-center">
        <p className="text-sm text-white/60">
          Component contribution details appear once an active assessment plan and grading policy are
          linked.
        </p>
      </GlassPanel>
    );
  }

  async function handleToggleContribution(
    assessmentItemId: string,
    contributesToReport: boolean
  ) {
    setPendingItemId(assessmentItemId);
    try {
      await busy.promise(
        updateItem.mutateAsync({
          id: assessmentItemId,
          classGroupId,
          subjectId,
          input: { contributesToReport },
        }),
        {
          loading: contributesToReport ? "Including item…" : "Excluding item…",
          success: contributesToReport
            ? "Item included in report contribution"
            : "Item excluded from report contribution",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to update contribution",
        }
      );
      onRefresh?.();
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4 sm:p-5" glow="cyan">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10">
            <Info className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">How report contribution works</h3>
            <p className="mt-1 text-sm leading-6 text-white/60">
              Each grading component uses the assessment plan rule to decide which items count.
              Teacher-selected components can be toggled below; rule-based components are managed
              automatically by the system.
            </p>
          </div>
        </div>
      </GlassPanel>

      {gradebook.componentSummary.map((component) => {
        const modeLabel =
          CONTRIBUTION_MODE_LABELS[component.contributionMode] ?? component.contributionMode;
        const modeExplanation = getComponentContributionModeExplanation({
          contributionMode: component.contributionMode,
          rule: component.rule,
          contributingItemCount: component.contributingItemCount,
          eligibleItemCount: component.eligibleItemCount,
          assessmentPlan: gradebook.assessmentPlan,
        });
        const isTeacherSelected = component.contributionMode === "teacher_selected";

        return (
          <GlassPanel key={component.componentKey} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{component.label}</h3>
                <p className="mt-1 text-xs text-white/50">
                  Weight {component.weight}% · {modeLabel}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  component.ready
                    ? "border-emerald-500/30 text-emerald-100"
                    : "border-amber-500/30 text-amber-100"
                }
              >
                {component.ready ? "Ready" : "Needs attention"}
              </Badge>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/60">{modeExplanation}</p>

            <p className="mt-2 text-sm text-white/50">
              {component.contributingItemCount} contributing item
              {component.contributingItemCount === 1 ? "" : "s"} ·{" "}
              {component.studentsFullyScored}/{component.studentsExpected} students fully scored
            </p>

            {component.items.length > 0 ? (
              <div className="mt-4 space-y-2">
                {component.items.map((item) => {
                  const display = getItemContributionDisplay({
                    item,
                    component,
                    assessmentPlan: gradebook.assessmentPlan,
                    canRecord,
                  });
                  const isPending = pendingItemId === item.assessmentItemId;

                  return (
                    <div
                      key={item.assessmentItemId}
                      className={cn(
                        glassInsetClass,
                        "flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{item.title}</p>
                          <Badge
                            variant="outline"
                            className={STATUS_BADGE_STYLES[display.status]}
                          >
                            {display.statusLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-white/45">
                          {humanizeAssessmentType(item.assessmentType)} · Max {item.maxScore}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/50">
                          {display.explanation}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-white/50">
                          {item.scoredStudentCount}/{component.studentsExpected} scored
                        </span>
                        {isTeacherSelected ? (
                          <div className="flex items-center gap-2">
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin text-teal-200" />
                            ) : null}
                            <Switch
                              checked={display.switchChecked}
                              disabled={!display.canToggle || isPending || updateItem.isPending}
                              onCheckedChange={(value) =>
                                void handleToggleContribution(item.assessmentItemId, value)
                              }
                              aria-label={`Include ${item.title} in report contribution`}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/50">No eligible items for this component yet.</p>
            )}

            {component.issues.length > 0 ? (
              <ul className="mt-4 space-y-1 text-xs text-amber-200">
                {component.issues.map((issue) => (
                  <li key={`${component.componentKey}-${issue.code}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
          </GlassPanel>
        );
      })}
    </div>
  );
}
