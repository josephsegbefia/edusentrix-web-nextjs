"use client";

import * as React from "react";
import {
  Archive,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { AssessmentPlanDTO } from "@/types/academics/assessment-engine";
import { AssessmentPlanWizard } from "@/components/admin/academics/assessment-plans/AssessmentPlanWizard";
import { MVP_CONTRIBUTION_MODE_OPTIONS } from "@/components/admin/academics/assessment-plans/assessment-plan-form";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import {
  useActivateAssessmentPlan,
  useArchiveAssessmentPlan,
  useAssessmentPlans,
} from "@/hooks/admin/useAssessmentPlans";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useGradingPolicies } from "@/hooks/admin/useGradingPolicies";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white/70",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  archived: "border-white/10 bg-white/5 text-white/45",
};

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function PlanRow({
  plan,
  periodLabel,
  gradeLabel,
  policyName,
  onEdit,
  onActivate,
  onArchive,
  activating,
  archiving,
}: {
  plan: AssessmentPlanDTO;
  periodLabel: string;
  gradeLabel: string;
  policyName: string;
  onEdit: () => void;
  onActivate: () => void;
  onArchive: () => void;
  activating: boolean;
  archiving: boolean;
}) {
  const ruleSummary = plan.componentRules
    .map((rule) => {
      const mode =
        MVP_CONTRIBUTION_MODE_OPTIONS.find((option) => option.value === rule.contributionMode)
          ?.label ?? rule.contributionMode;
      return `${rule.componentKey}: ${mode}`;
    })
    .join(" · ");

  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{plan.name}</h3>
            <Badge variant="outline" className={STATUS_STYLES[plan.status] ?? STATUS_STYLES.draft}>
              {formatStatus(plan.status)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {periodLabel} · {gradeLabel} · {plan.appliesToClassGroupIds.length} class group
            {plan.appliesToClassGroupIds.length === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs text-white/50">Policy: {policyName}</p>
          <p className="mt-1 text-xs text-white/40">{ruleSummary || "No component rules configured"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan.status !== "archived" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={glassSecondaryButtonClass}
                onClick={onEdit}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
              {plan.status !== "active" ? (
                <Button
                  type="button"
                  size="sm"
                  className={glassPrimaryButtonClass}
                  onClick={onActivate}
                  disabled={activating}
                >
                  {activating ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  )}
                  Activate
                </Button>
              ) : null}
            </>
          ) : null}
          {plan.status !== "archived" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-rose-500/25 bg-rose-500/5 text-rose-100 hover:bg-rose-500/10"
              onClick={onArchive}
              disabled={archiving}
            >
              <Archive className="mr-2 h-3.5 w-3.5" />
              Archive
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminAssessmentPlansPage() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [periodFilter, setPeriodFilter] = React.useState("all");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<AssessmentPlanDTO | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const { data: periodsData } = useAcademicPeriods();
  const { data: gradesData } = useGradeOptions();
  const { data: policiesData } = useGradingPolicies({ status: "all" });

  const { data, isLoading, error, refetch, isFetching } = useAssessmentPlans({
    status: statusFilter,
    academicPeriodId: periodFilter,
  });
  const activatePlan = useActivateAssessmentPlan();
  const archivePlan = useArchiveAssessmentPlan();

  const periods = periodsData?.periods ?? [];
  const grades = gradesData ?? [];
  const policies = policiesData?.data ?? [];
  const plans = data?.data ?? [];
  const activeCount = plans.filter((plan) => plan.status === "active").length;

  const periodById = React.useMemo(
    () =>
      new Map(
        periods.map((period) => [
          period._id,
          `${period.yearLabel} · ${period.term}${period.isCurrent ? " (Current)" : ""}`,
        ])
      ),
    [periods]
  );
  const gradeById = React.useMemo(
    () => new Map(grades.map((grade) => [grade._id, grade.name])),
    [grades]
  );
  const policyById = React.useMemo(
    () => new Map(policies.map((policy) => [policy._id, policy.name])),
    [policies]
  );

  function openCreateWizard() {
    setSelectedPlan(null);
    setWizardOpen(true);
  }

  function openEditWizard(plan: AssessmentPlanDTO) {
    setSelectedPlan(plan);
    setWizardOpen(true);
  }

  async function handleActivate(plan: AssessmentPlanDTO) {
    const result = await confirm({
      title: "Activate assessment plan?",
      description: `This will activate "${plan.name}" and archive overlapping active plans for the same period and class groups.`,
      confirmLabel: "Activate",
    });
    if (result !== "confirm") return;

    setActivatingId(plan._id);
    try {
      await busy.promise(activatePlan.mutateAsync(plan._id), {
        loading: "Activating assessment plan…",
        success: "Assessment plan activated.",
        error: (err) => err.message,
      });
    } finally {
      setActivatingId(null);
    }
  }

  async function handleArchive(plan: AssessmentPlanDTO) {
    const result = await confirm({
      title: "Archive assessment plan?",
      description: `"${plan.name}" will be archived and teachers will no longer use it for new mark entry.`,
      confirmLabel: "Archive",
      intent: "destructive",
    });
    if (result !== "confirm") return;

    setArchivingId(plan._id);
    try {
      await busy.promise(archivePlan.mutateAsync(plan._id), {
        loading: "Archiving assessment plan…",
        success: "Assessment plan archived.",
        error: (err) => err.message,
      });
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <>
      {confirmationDialog}
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="list-checks"
          title="Assessment Plans"
          subtitle="Configure how marks roll up into report cards for each grade, term, and class group."
          backHref="/admin/academics/grading"
          backLabel="Grading Policies"
          actions={
            <Button type="button" className={glassPrimaryButtonClass} onClick={openCreateWizard}>
              <Plus className="mr-2 h-4 w-4" />
              New plan
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <GlassPanel className="p-4" glow="teal">
            <p className="text-xs uppercase tracking-wide text-white/45">Plans</p>
            <p className="mt-2 text-2xl font-semibold text-white">{plans.length}</p>
          </GlassPanel>
          <GlassPanel className="p-4" glow="cyan">
            <p className="text-xs uppercase tracking-wide text-white/45">Active</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activeCount}</p>
          </GlassPanel>
          <GlassPanel className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">Contribution modes</p>
            <p className="mt-2 text-sm text-white/75">
              Teacher-selected and rule-based modes per score component
            </p>
          </GlassPanel>
        </div>

        <GlassPanel className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Plan list</h2>
              <p className="mt-1 text-sm text-white/55">
                Link a grading policy to a grade and term, then define how each component collects marks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PremiumSelect value={periodFilter} onValueChange={setPeriodFilter}>
                <PremiumSelectTrigger className="w-[180px]">
                  <PremiumSelectValue placeholder="Period" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All periods</PremiumSelectItem>
                  {periods.map((period) => (
                    <PremiumSelectItem key={period._id} value={period._id}>
                      {period.yearLabel} · {period.term}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
                <PremiumSelectTrigger className="w-[160px]">
                  <PremiumSelectValue placeholder="Status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                  <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                  <PremiumSelectItem value="active">Active</PremiumSelectItem>
                  <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={glassSecondaryButtonClass}
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-white/60">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading assessment plans…
              </div>
            ) : error ? (
              <div className={cn(glassInsetClass, "p-6 text-center")}>
                <p className="text-sm text-rose-200">
                  {error instanceof Error ? error.message : "Failed to load assessment plans."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("mt-4", glassSecondaryButtonClass)}
                  onClick={() => void refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : plans.length === 0 ? (
              <div className={cn(glassInsetClass, "px-6 py-10 text-center")}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">No assessment plan yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">
                  Create an assessment plan after you have an active grading policy. Plans define how
                  teacher marks contribute to report cards.
                </p>
                <Button
                  type="button"
                  className={cn("mt-5", glassPrimaryButtonClass)}
                  onClick={openCreateWizard}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create assessment plan
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <PlanRow
                    key={plan._id}
                    plan={plan}
                    periodLabel={periodById.get(plan.academicPeriodId) ?? "Unknown period"}
                    gradeLabel={gradeById.get(plan.appliesToGradeId) ?? "Unknown grade"}
                    policyName={policyById.get(plan.gradingPolicyId) ?? "Unknown policy"}
                    onEdit={() => openEditWizard(plan)}
                    onActivate={() => void handleActivate(plan)}
                    onArchive={() => void handleArchive(plan)}
                    activating={activatingId === plan._id}
                    archiving={archivingId === plan._id}
                  />
                ))}
              </div>
            )}
          </div>
        </GlassPanel>
      </WorkspacePageShell>

      <AssessmentPlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        plan={selectedPlan}
        onCompleted={() => void refetch()}
      />
    </>
  );
}
