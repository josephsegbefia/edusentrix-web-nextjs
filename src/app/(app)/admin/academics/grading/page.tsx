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
import { COMPONENT_WEIGHT_TOTAL } from "@/constants/academics/assessment-engine";
import type { AcademicGradingPolicyDTO } from "@/types/academics/assessment-engine";
import { GradingPolicyDrawer } from "@/components/admin/academics/grading/GradingPolicyDrawer";
import {
  useActivateGradingPolicy,
  useArchiveGradingPolicy,
  useGradingPolicies,
} from "@/hooks/admin/useGradingPolicies";
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

function PolicyRow({
  policy,
  onEdit,
  onActivate,
  onArchive,
  activating,
  archiving,
}: {
  policy: AcademicGradingPolicyDTO;
  onEdit: () => void;
  onActivate: () => void;
  onArchive: () => void;
  activating: boolean;
  archiving: boolean;
}) {
  const componentSummary = policy.scoreComponents
    .map((component) => `${component.label} ${component.weight}%`)
    .join(" · ");

  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{policy.name}</h3>
            <Badge variant="outline" className={STATUS_STYLES[policy.status] ?? STATUS_STYLES.draft}>
              {formatStatus(policy.status)}
            </Badge>
            {policy.isDefault ? (
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
                Default
              </Badge>
            ) : null}
          </div>
          {policy.description ? (
            <p className="mt-2 text-sm text-white/60">{policy.description}</p>
          ) : null}
          <p className="mt-3 text-xs text-white/50">{componentSummary || "No components configured"}</p>
          <p className="mt-1 text-xs text-white/40">
            Pass mark {policy.passMark}% · {policy.gradeBoundaries.length} grade boundaries
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {policy.status !== "archived" ? (
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
              {policy.status !== "active" ? (
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
          {policy.status !== "archived" ? (
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

export default function AdminGradingPoliciesPage() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedPolicy, setSelectedPolicy] = React.useState<AcademicGradingPolicyDTO | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useGradingPolicies({
    status: statusFilter,
  });
  const activatePolicy = useActivateGradingPolicy();
  const archivePolicy = useArchiveGradingPolicy();

  const policies = data?.data ?? [];
  const activeCount = policies.filter((policy) => policy.status === "active").length;

  function openCreateDrawer() {
    setSelectedPolicy(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(policy: AcademicGradingPolicyDTO) {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  }

  async function handleActivate(policy: AcademicGradingPolicyDTO) {
    const result = await confirm({
      title: "Activate grading policy?",
      description: `This will activate "${policy.name}" and archive overlapping active policies for the same scope.`,
      confirmLabel: "Activate",
    });
    if (result !== "confirm") return;

    setActivatingId(policy._id);
    try {
      await busy.promise(activatePolicy.mutateAsync(policy._id), {
        loading: "Activating grading policy…",
        success: "Grading policy activated.",
        error: (err) => err.message,
      });
    } finally {
      setActivatingId(null);
    }
  }

  async function handleArchive(policy: AcademicGradingPolicyDTO) {
    const result = await confirm({
      title: "Archive grading policy?",
      description: `"${policy.name}" will be archived and cannot be assigned to new assessment plans.`,
      confirmLabel: "Archive",
      intent: "destructive",
    });
    if (result !== "confirm") return;

    setArchivingId(policy._id);
    try {
      await busy.promise(archivePolicy.mutateAsync(policy._id), {
        loading: "Archiving grading policy…",
        success: "Grading policy archived.",
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
          iconName="percent"
          title="Grading Policies"
          subtitle="Define score breakdowns, grade labels, and report-card rules for your school."
          backHref="/admin/periods"
          backLabel="Academic Periods"
          actions={
            <Button type="button" className={glassPrimaryButtonClass} onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              New policy
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <GlassPanel className="p-4" glow="teal">
            <p className="text-xs uppercase tracking-wide text-white/45">Policies</p>
            <p className="mt-2 text-2xl font-semibold text-white">{policies.length}</p>
          </GlassPanel>
          <GlassPanel className="p-4" glow="cyan">
            <p className="text-xs uppercase tracking-wide text-white/45">Active</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activeCount}</p>
          </GlassPanel>
          <GlassPanel className="p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">Component rule</p>
            <p className="mt-2 text-sm text-white/75">Weights must total {COMPONENT_WEIGHT_TOTAL}%</p>
          </GlassPanel>
        </div>

        <GlassPanel className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Policy list</h2>
              <p className="mt-1 text-sm text-white/55">
                Create a policy, then activate it when you are ready to use it in assessment plans.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                Loading grading policies…
              </div>
            ) : error ? (
              <div className={cn(glassInsetClass, "p-6 text-center")}>
                <p className="text-sm text-rose-200">
                  {error instanceof Error ? error.message : "Failed to load grading policies."}
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
            ) : policies.length === 0 ? (
              <div className={cn(glassInsetClass, "px-6 py-10 text-center")}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">No grading policy yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">
                  Create a grading policy to define score breakdowns, grade labels, and report-card
                  rules.
                </p>
                <Button
                  type="button"
                  className={cn("mt-5", glassPrimaryButtonClass)}
                  onClick={openCreateDrawer}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create grading policy
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {policies.map((policy) => (
                  <PolicyRow
                    key={policy._id}
                    policy={policy}
                    onEdit={() => openEditDrawer(policy)}
                    onActivate={() => void handleActivate(policy)}
                    onArchive={() => void handleArchive(policy)}
                    activating={activatingId === policy._id}
                    archiving={archivingId === policy._id}
                  />
                ))}
              </div>
            )}
          </div>
        </GlassPanel>
      </WorkspacePageShell>

      <GradingPolicyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        policy={selectedPolicy}
        onSaved={() => void refetch()}
      />
    </>
  );
}
